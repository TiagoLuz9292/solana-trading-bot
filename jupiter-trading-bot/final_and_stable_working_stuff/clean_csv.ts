import { promises as fsPromises } from 'fs';

async function cleanUpCSV(csvFilePath: string): Promise<void> {
    let fileContent = await fsPromises.readFile(csvFilePath, 'utf-8');
    let lines = fileContent.split('\n');
    let cleanedLines: string[] = [];

    for (let line of lines) {
        let cleanedLine = line.split(',').map(field => {
            // Trim whitespace
            field = field.trim();

            // Correct unescaped internal quotes and ensure the field is properly quoted
            if (field.startsWith('"') && !field.endsWith('"')) {
                field += '"'; // Add a closing quote if missing
            }
            field = field.replace(/(?<!")"(?!")/g, '""'); // Escape unquoted internal quotes

            return field;
        }).join(',');

        cleanedLines.push(cleanedLine);
    }

    await fsPromises.writeFile(csvFilePath, cleanedLines.join('\n'), 'utf-8');
}



(async () => {
    try {
      await cleanUpCSV("/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/open_orders_v2.csv");
      // If you have more code to run after cleanup, you can continue here.
      console.log('Cleanup successful.');
    } catch (error) {
      console.error('An error occurred during cleanup:', error);
    }
  })();

