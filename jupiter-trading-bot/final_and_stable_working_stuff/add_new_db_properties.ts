import client from 'telegraf/typings/core/network/client';
import { addNewPropertiesToAllRecords, connectToDatabase, getDatabase } from './mongoDB_connection';

async function main() {

    await connectToDatabase();
    
    const db = getDatabase("sniperbot-tg");

    const telegramId = "7004088797";


    await addNewPropertiesToAllRecords(db);

    console.log("Telegram ID added to access list successfully.");
}

main().catch(console.error);

