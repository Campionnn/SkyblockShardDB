// tsc src/main.ts --module none --target es2020
interface Shard {
    id: string;
    name: string;
    family: string;
    type: string;
    rarity: string;
    fuse_amount: number;
    internal_id: string;
    rate: number;
}

type Recipe = {
    inputs: [string, string];
    outputQuantity: number;
};

type Recipes = {
    [shardId: string]: Recipe[];
};

type Shards = {
    [shardId: string]: Shard;
};

interface Data {
    recipes: Recipes;
    shards: Shards;
}

interface RecipeChoice {
    recipe: Recipe | null;
}

interface RecipeTree {
    shard: string;
    method: 'direct' | 'recipe';
    quantity: number;
    recipe?: Recipe;
    inputs?: RecipeTree[];
}

const noFortuneShards = ["C19", "U4", "U16", "U28", "R25", "L4", "L15"]

async function parseData(
    customRates: { [shardId: string]: number },
    hunterFortune: number,
    excludeChameleon: boolean,
    frogPet: boolean,
    newtLevel: number,
    salamanderLevel: number,
    lizardKingLevel: number,
    leviathanLevel: number
): Promise<Data> {
    try {
        const fusionResponse = await fetch('fusion-data.json');
        const fusionJson = await fusionResponse.json();

        const ratesResponse = await fetch('rates.json');
        const defaultRates = await ratesResponse.json();

        const recipes: Recipes = {};
        for (const outputShard in fusionJson.recipes) {
            recipes[outputShard] = [];
            for (const qtyStr in fusionJson.recipes[outputShard]) {
                const qty = parseInt(qtyStr);
                const recipeList = fusionJson.recipes[outputShard][qtyStr];
                recipeList.forEach((inputs: [string, string]) => {
                    recipes[outputShard].push({ inputs, outputQuantity: qty });
                });
            }
        }

        const shards: Shards = {};
        for (const shardId in fusionJson.shards) {
            let rate = customRates[shardId] ?? (defaultRates[shardId] ?? 0);
            if (rate > 0) {
                if (!noFortuneShards.includes(shardId)) {
                    let effectiveFortune = hunterFortune;
                    if (frogPet) {
                        rate *= 1.1;
                    }
                    if (fusionJson.shards[shardId].rarity === 'common') {
                        effectiveFortune += 2 * newtLevel;
                    }
                    else if (fusionJson.shards[shardId].rarity === 'uncommon') {
                        effectiveFortune += 2 * salamanderLevel;
                    }
                    else if (fusionJson.shards[shardId].rarity === 'rare') {
                        effectiveFortune += lizardKingLevel;
                    }
                    else if (fusionJson.shards[shardId].rarity === 'epic') {
                        effectiveFortune += leviathanLevel;
                    }
                    rate *= (1 + (effectiveFortune / 100));
                }
            }
            if (excludeChameleon && shardId === 'L4') {
                rate = 0;
            }
            shards[shardId] = {
                ...fusionJson.shards[shardId],
                rate
            };
        }

        return { recipes, shards };
    } catch (error) {
        throw new Error(`Failed to parse data: ${error}`);
    }
}

function computeMinCosts(data: Data): { minCosts: Map<string, number>, choices: Map<string, RecipeChoice> } {
    const minCosts = new Map<string, number>();
    const choices = new Map<string, RecipeChoice>();
    const shards = Object.keys(data.shards);

    shards.forEach(shard => {
        const cost = data.shards[shard].rate > 0 ? 1 / data.shards[shard].rate : Infinity;
        minCosts.set(shard, cost);
        choices.set(shard, { recipe: null });
    });

    let updated = true;
    while (updated) {
        updated = false;
        shards.forEach(outputShard => {
            const recipes = data.recipes[outputShard] || [];
            recipes.forEach(recipe => {
                const [input1, input2] = recipe.inputs;
                const fuse1 = data.shards[input1].fuse_amount;
                const fuse2 = data.shards[input2].fuse_amount;
                const costInput1 = minCosts.get(input1)! * fuse1;
                const costInput2 = minCosts.get(input2)! * fuse2;
                const totalCost = costInput1 + costInput2;
                const costPerUnit = totalCost / recipe.outputQuantity;
                if (costPerUnit < minCosts.get(outputShard)!) {
                    minCosts.set(outputShard, costPerUnit);
                    choices.set(outputShard, { recipe });
                    updated = true;
                }
            });
        });
    }
    return { minCosts, choices };
}

function buildRecipeTree(shard: string, choices: Map<string, RecipeChoice>): RecipeTree {
    const choice = choices.get(shard)!;
    if (choice.recipe === null) {
        return { shard, method: 'direct', quantity: 0 };
    } else {
        const recipe = choice.recipe;
        const [input1, input2] = recipe.inputs;
        const tree1 = buildRecipeTree(input1, choices);
        const tree2 = buildRecipeTree(input2, choices);
        return { shard, method: 'recipe', recipe, inputs: [tree1, tree2], quantity: 0 };
    }
}

function assignQuantities(tree: RecipeTree, requiredQuantity: number, data: Data) {
    tree.quantity = requiredQuantity;
    if (tree.method === 'recipe') {
        const recipe = tree.recipe!;
        const outputQuantity = recipe.outputQuantity;
        const craftsNeeded = Math.ceil(requiredQuantity / outputQuantity);
        const [input1, input2] = recipe.inputs;
        const fuse1 = data.shards[input1].fuse_amount;
        const fuse2 = data.shards[input2].fuse_amount;
        const input1Quantity = craftsNeeded * fuse1;
        const input2Quantity = craftsNeeded * fuse2;
        assignQuantities(tree.inputs![0], input1Quantity, data);
        assignQuantities(tree.inputs![1], input2Quantity, data);
    }
}

function collectTotalQuantities(tree: RecipeTree): Map<string, number> {
    const totals = new Map<string, number>();
    function traverse(node: RecipeTree) {
        if (node.method === 'direct') {
            const current = totals.get(node.shard) || 0;
            totals.set(node.shard, current + node.quantity);
        } else {
            node.inputs!.forEach(traverse);
        }
    }
    traverse(tree);
    return totals;
}

function shardDetails(shard: Shard): string {
    return `ID: ${shard.id}\nName: ${shard.name}\nFamily: ${shard.family}\nType: ${shard.type}\nRarity: ${shard.rarity}\nFuse Amount: ${shard.fuse_amount}\nInternal ID: ${shard.internal_id}\nRate: ${shard.rate}`;
}

function decimalHoursToHoursMinutes(decimalHours: number): string {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    if (minutes === 0 || isNaN(minutes)) {
        return `${hours} hours`;
    }
    if (hours === 0) {
        return `${minutes} minutes`;
    }
    return `${hours} hours ${minutes} minutes`;
}

function displayTree(tree: RecipeTree, data: Data, isTopLevel: boolean = false, totalShardsProduced: number = tree.quantity): string {
    const shard = data.shards[tree.shard];
    const shardName = `<span title="${shardDetails(shard)}">${shard.name}</span>`;
if (tree.method === 'direct') {
    return `<div>${shardName}: ${tree.quantity} (direct)</div>`;
} else {
    const input1 = tree.inputs![0];
    const input2 = tree.inputs![1];
    const input1Name = `<span title="${shardDetails(data.shards[input1.shard])}">${data.shards[input1.shard].name}</span>`;
    const input2Name = `<span title="${shardDetails(data.shards[input2.shard])}">${data.shards[input2.shard].name}</span>`;
    const displayQuantity = isTopLevel ? totalShardsProduced : tree.quantity;
    const summary = `${displayQuantity}x ${shardName} = ${input1.quantity}x ${input1Name} + ${input2.quantity}x ${input2Name}`;
    return `
<details open>
    <summary>${summary}</summary>
    <div style="margin-left: 20px;">
        ${displayTree(input1, data)}
        ${displayTree(input2, data)}
    </div>
</details>
`;
}
}

let data: Data;

async function getRecipeTree(targetShard: string,
                             requiredQuantity: number,
                             customRates: { [shardId: string]: number },
                             hunterFortune: number,
                             excludeChameleon: boolean,
                             frogPet: boolean,
                             newtLevel: number,
                             salamanderLevel: number,
                             lizardKingLevel: number,
                             leviathanLevel: number
): Promise<string> {
    try {
        data = await parseData(customRates, hunterFortune, excludeChameleon, frogPet, newtLevel, salamanderLevel, lizardKingLevel, leviathanLevel);

        if (!data.shards[targetShard]) {
            throw new Error(`Shard ${targetShard} not found in the data.`);
        }

        const { minCosts, choices } = computeMinCosts(data);
        const tree = buildRecipeTree(targetShard, choices);
        assignQuantities(tree, requiredQuantity, data);
        const totalQuantities = collectTotalQuantities(tree);

        let totalShardsProduced = requiredQuantity;
        let craftsNeeded = 1;
        const choice = choices.get(targetShard);
        if (choice?.recipe) {
            const outputQuantity = choice.recipe.outputQuantity;
            craftsNeeded = Math.ceil(requiredQuantity / outputQuantity);
            totalShardsProduced = craftsNeeded * outputQuantity;
        }

        const totalMaterialsHtml = `
<h3>Time per shard for ${data.shards[targetShard].name}: ${decimalHoursToHoursMinutes(minCosts.get(targetShard) ?? 0)}</h3>
<h3>Total time for ${totalShardsProduced} ${data.shards[targetShard].name} (${craftsNeeded} craft${craftsNeeded > 1 ? 's' : ''}): ${decimalHoursToHoursMinutes((minCosts.get(targetShard) ?? 0) * totalShardsProduced)}</h3>
<h3>Total shards needed for ${requiredQuantity} ${data.shards[targetShard].name}:</h3>
<ul>
${Array.from(totalQuantities).map(([shardId, qty]) => `<li>${qty}x ${data.shards[shardId].name} at ${data.shards[shardId].rate.toFixed(2).replace(/\.00$/, '')}/hour = ${decimalHoursToHoursMinutes(qty / data.shards[shardId].rate)}</li>`).join('')}
</ul>
<h2>Fusion Tree:</h2>
`;

        let treeHtml = displayTree(tree, data, true, totalShardsProduced);

        return totalMaterialsHtml + treeHtml;
    } catch (error) {
        return 'An error occurred while processing the recipe tree.';
    }
}

(window as any).getRecipeTree = getRecipeTree;

function resetRates() {
    localStorage.removeItem('customRates');
}

(window as any).resetRates = resetRates;