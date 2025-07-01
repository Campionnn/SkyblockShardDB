interface Shard {
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

async function parseData(): Promise<Data> {
    try {
        const fusionResponse = await fetch('fusion-data.json');
        const fusionJson = await fusionResponse.json();

        const ratesResponse = await fetch('rates.json');
        const ratesJson = await ratesResponse.json();

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
            shards[shardId] = {
                ...fusionJson.shards[shardId],
                rate: ratesJson[shardId] !== undefined ? ratesJson[shardId] : 0
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
        const craftsNeeded = requiredQuantity / outputQuantity;
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
    return `Name: ${shard.name}\nFamily: ${shard.family}\nType: ${shard.type}\nRarity: ${shard.rarity}\nFuse Amount: ${shard.fuse_amount}\nInternal ID: ${shard.internal_id}\nRate: ${shard.rate}`;
}

function displayTree(tree: RecipeTree, data: Data): string {
    const shard = data.shards[tree.shard];
    const shardName = `<span title="${shardDetails(shard)}">${shard.name}</span>`;
    if (tree.method === 'direct') {
        return `<div>${shardName}: ${tree.quantity.toFixed(2)} (direct)</div>`;
    } else {
        // const recipe = tree.recipe!;
        const input1 = tree.inputs![0];
        const input2 = tree.inputs![1];
        const input1Name = `<span title="${shardDetails(data.shards[input1.shard])}">${data.shards[input1.shard].name}</span>`;
        const input2Name = `<span title="${shardDetails(data.shards[input2.shard])}">${data.shards[input2.shard].name}</span>`;
        const summary = `${tree.quantity.toFixed(2)}x ${shardName} = ${input1.quantity.toFixed(2)}x ${input1Name} + ${input2.quantity.toFixed(2)}x ${input2Name}`;
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

export async function getRecipeTree(targetShard: string, requiredQuantity: number = 1): Promise<string> {
    try {
        data = await parseData();

        if (!data.shards[targetShard]) {
            throw new Error(`Shard ${targetShard} not found in the data.`);
        }

        const { minCosts, choices } = computeMinCosts(data);
        const tree = buildRecipeTree(targetShard, choices);
        assignQuantities(tree, requiredQuantity, data);
        const totalQuantities = collectTotalQuantities(tree);

        const totalMaterialsHtml = `
<h3>Time per shard for ${data.shards[targetShard].name}: ${(minCosts.get(targetShard) ?? 0).toFixed(2)} hours</h3>
<h3>Total time for ${requiredQuantity} ${data.shards[targetShard].name}: ${((minCosts.get(targetShard) ?? 0) * requiredQuantity).toFixed(2)} hours</h3>
<h3>Total Materials Needed for ${requiredQuantity} of ${data.shards[targetShard].name}:</h3>
<ul>
${Array.from(totalQuantities).map(([shardId, qty]) => `<li>${data.shards[shardId].name}: ${qty.toFixed(2)}</li>`).join('')}
</ul>
`;

        let treeHtml = displayTree(tree, data);

        console.log(`Time per shard for ${targetShard}: ${(minCosts.get(targetShard) ?? 0).toFixed(4)} hours`);
        return totalMaterialsHtml + treeHtml;
    } catch (error) {
        console.error('Error:', error);
        return 'An error occurred while processing the recipe tree.';
    }
}