import { addTelegramIdToAccessList, connectToDatabase, getDatabase } from './mongoDB_connection';

async function main() {

    await connectToDatabase();
    
    const db = getDatabase("sniperbot-tg");

    const telegramId = "465136049";


    await addTelegramIdToAccessList(parseFloat(telegramId), db);

    console.log("Telegram ID added to access list successfully.");
}

main().catch(console.error);