import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readFileSync, writeFileSync } from 'fs';

const csvFile = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions.csv";
const data = readFileSync(csvFile, { encoding: 'utf8' });

const records = parse(data, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
});

const targetAddress = 'FjhvCzEYkENYAY3QTjRjMCMK2hGpivqn8A2rruiLnPiE';
records.forEach((record: any) => {
    if (record.address === targetAddress) {
        record.second_TP_amount_token_sold = 'none';
    }
});

const updatedCsv = stringify(records, { header: true });
writeFileSync(csvFile, updatedCsv);
