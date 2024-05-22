import {connectToDatabase, deleteOldRecords, getDatabase } from './mongoDB_connection'





(async () => {
    try {

        await connectToDatabase();
    
        const db = getDatabase("sniperbot");
        const balances = await deleteOldRecords(db);
        console.log('Balances:', balances);
        } catch (error) {
        console.error('Error fetching wallet balances:', error);
    }
  })();