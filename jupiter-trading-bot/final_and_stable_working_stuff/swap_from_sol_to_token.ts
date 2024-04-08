import { swap_from_sol_to_token } from './jupiter_SWAP_buy_and_sell';

const args = process.argv.slice(2);
console.log("System Arguments:", args);

// Assuming swap_from_sol_to_token function returns a value you want to send back to Python
const amount_sol = parseFloat(args[0]);
const token_name = args[1];

(async () => {
    const result = await swap_from_sol_to_token(amount_sol, token_name);
    console.log(result); // This will be captured by Python
})();