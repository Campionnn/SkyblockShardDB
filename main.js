"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecipeTree = getRecipeTree;
function parseData() {
    return __awaiter(this, void 0, void 0, function () {
        var fusionResponse, fusionJson, ratesResponse, ratesJson, recipes_1, _loop_1, outputShard, shards, shardId, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, fetch('fusion-data.json')];
                case 1:
                    fusionResponse = _a.sent();
                    return [4 /*yield*/, fusionResponse.json()];
                case 2:
                    fusionJson = _a.sent();
                    return [4 /*yield*/, fetch('rates.json')];
                case 3:
                    ratesResponse = _a.sent();
                    return [4 /*yield*/, ratesResponse.json()];
                case 4:
                    ratesJson = _a.sent();
                    recipes_1 = {};
                    _loop_1 = function (outputShard) {
                        recipes_1[outputShard] = [];
                        var _loop_2 = function (qtyStr) {
                            var qty = parseInt(qtyStr);
                            var recipeList = fusionJson.recipes[outputShard][qtyStr];
                            recipeList.forEach(function (inputs) {
                                recipes_1[outputShard].push({ inputs: inputs, outputQuantity: qty });
                            });
                        };
                        for (var qtyStr in fusionJson.recipes[outputShard]) {
                            _loop_2(qtyStr);
                        }
                    };
                    for (outputShard in fusionJson.recipes) {
                        _loop_1(outputShard);
                    }
                    shards = {};
                    for (shardId in fusionJson.shards) {
                        shards[shardId] = __assign(__assign({}, fusionJson.shards[shardId]), { rate: ratesJson[shardId] !== undefined ? ratesJson[shardId] : 0 });
                    }
                    return [2 /*return*/, { recipes: recipes_1, shards: shards }];
                case 5:
                    error_1 = _a.sent();
                    throw new Error("Failed to parse data: ".concat(error_1));
                case 6: return [2 /*return*/];
            }
        });
    });
}
function computeMinCosts(data) {
    var minCosts = new Map();
    var choices = new Map();
    var shards = Object.keys(data.shards);
    shards.forEach(function (shard) {
        var cost = data.shards[shard].rate > 0 ? 1 / data.shards[shard].rate : Infinity;
        minCosts.set(shard, cost);
        choices.set(shard, { recipe: null });
    });
    var updated = true;
    while (updated) {
        updated = false;
        shards.forEach(function (outputShard) {
            var recipes = data.recipes[outputShard] || [];
            recipes.forEach(function (recipe) {
                var _a = recipe.inputs, input1 = _a[0], input2 = _a[1];
                var fuse1 = data.shards[input1].fuse_amount;
                var fuse2 = data.shards[input2].fuse_amount;
                var costInput1 = minCosts.get(input1) * fuse1;
                var costInput2 = minCosts.get(input2) * fuse2;
                var totalCost = costInput1 + costInput2;
                var costPerUnit = totalCost / recipe.outputQuantity;
                if (costPerUnit < minCosts.get(outputShard)) {
                    minCosts.set(outputShard, costPerUnit);
                    choices.set(outputShard, { recipe: recipe });
                    updated = true;
                }
            });
        });
    }
    return { minCosts: minCosts, choices: choices };
}
function buildRecipeTree(shard, choices) {
    var choice = choices.get(shard);
    if (choice.recipe === null) {
        return { shard: shard, method: 'direct', quantity: 0 };
    }
    else {
        var recipe = choice.recipe;
        var _a = recipe.inputs, input1 = _a[0], input2 = _a[1];
        var tree1 = buildRecipeTree(input1, choices);
        var tree2 = buildRecipeTree(input2, choices);
        return { shard: shard, method: 'recipe', recipe: recipe, inputs: [tree1, tree2], quantity: 0 };
    }
}
function assignQuantities(tree, requiredQuantity, data) {
    tree.quantity = requiredQuantity;
    if (tree.method === 'recipe') {
        var recipe = tree.recipe;
        var outputQuantity = recipe.outputQuantity;
        var craftsNeeded = requiredQuantity / outputQuantity;
        var _a = recipe.inputs, input1 = _a[0], input2 = _a[1];
        var fuse1 = data.shards[input1].fuse_amount;
        var fuse2 = data.shards[input2].fuse_amount;
        var input1Quantity = craftsNeeded * fuse1;
        var input2Quantity = craftsNeeded * fuse2;
        assignQuantities(tree.inputs[0], input1Quantity, data);
        assignQuantities(tree.inputs[1], input2Quantity, data);
    }
}
function collectTotalQuantities(tree) {
    var totals = new Map();
    function traverse(node) {
        if (node.method === 'direct') {
            var current = totals.get(node.shard) || 0;
            totals.set(node.shard, current + node.quantity);
        }
        else {
            node.inputs.forEach(traverse);
        }
    }
    traverse(tree);
    return totals;
}
function shardDetails(shard) {
    return "Name: ".concat(shard.name, "\nFamily: ").concat(shard.family, "\nType: ").concat(shard.type, "\nRarity: ").concat(shard.rarity, "\nFuse Amount: ").concat(shard.fuse_amount, "\nInternal ID: ").concat(shard.internal_id, "\nRate: ").concat(shard.rate);
}
function displayTree(tree, data) {
    var shard = data.shards[tree.shard];
    var shardName = "<span title=\"".concat(shardDetails(shard), "\">").concat(shard.name, "</span>");
    if (tree.method === 'direct') {
        return "<div>".concat(shardName, ": ").concat(tree.quantity.toFixed(2), " (direct)</div>");
    }
    else {
        // const recipe = tree.recipe!;
        var input1 = tree.inputs[0];
        var input2 = tree.inputs[1];
        var input1Name = "<span title=\"".concat(shardDetails(data.shards[input1.shard]), "\">").concat(data.shards[input1.shard].name, "</span>");
        var input2Name = "<span title=\"".concat(shardDetails(data.shards[input2.shard]), "\">").concat(data.shards[input2.shard].name, "</span>");
        var summary = "".concat(tree.quantity.toFixed(2), "x ").concat(shardName, " = ").concat(input1.quantity.toFixed(2), "x ").concat(input1Name, " + ").concat(input2.quantity.toFixed(2), "x ").concat(input2Name);
        return "\n<details open>\n    <summary>".concat(summary, "</summary>\n    <div style=\"margin-left: 20px;\">\n        ").concat(displayTree(input1, data), "\n        ").concat(displayTree(input2, data), "\n    </div>\n</details>\n");
    }
}
var data;
function getRecipeTree(targetShard_1) {
    return __awaiter(this, arguments, void 0, function (targetShard, requiredQuantity) {
        var _a, minCosts, choices, tree, totalQuantities, totalMaterialsHtml, treeHtml, error_2;
        var _b, _c, _d;
        if (requiredQuantity === void 0) { requiredQuantity = 1; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, parseData()];
                case 1:
                    data = _e.sent();
                    if (!data.shards[targetShard]) {
                        throw new Error("Shard ".concat(targetShard, " not found in the data."));
                    }
                    _a = computeMinCosts(data), minCosts = _a.minCosts, choices = _a.choices;
                    tree = buildRecipeTree(targetShard, choices);
                    assignQuantities(tree, requiredQuantity, data);
                    totalQuantities = collectTotalQuantities(tree);
                    totalMaterialsHtml = "\n<h3>Time per shard for ".concat(data.shards[targetShard].name, ": ").concat(((_b = minCosts.get(targetShard)) !== null && _b !== void 0 ? _b : 0).toFixed(2), " hours</h3>\n<h3>Total time for ").concat(requiredQuantity, " ").concat(data.shards[targetShard].name, ": ").concat((((_c = minCosts.get(targetShard)) !== null && _c !== void 0 ? _c : 0) * requiredQuantity).toFixed(2), " hours</h3>\n<h3>Total Materials Needed for ").concat(requiredQuantity, " of ").concat(data.shards[targetShard].name, ":</h3>\n<ul>\n").concat(Array.from(totalQuantities).map(function (_a) {
                        var shardId = _a[0], qty = _a[1];
                        return "<li>".concat(data.shards[shardId].name, ": ").concat(qty.toFixed(2), "</li>");
                    }).join(''), "\n</ul>\n");
                    treeHtml = displayTree(tree, data);
                    console.log("Time per shard for ".concat(targetShard, ": ").concat(((_d = minCosts.get(targetShard)) !== null && _d !== void 0 ? _d : 0).toFixed(4), " hours"));
                    return [2 /*return*/, totalMaterialsHtml + treeHtml];
                case 2:
                    error_2 = _e.sent();
                    console.error('Error:', error_2);
                    return [2 /*return*/, 'An error occurred while processing the recipe tree.'];
                case 3: return [2 /*return*/];
            }
        });
    });
}
