

// dbInsert.ts
import { startOfDay, endOfDay } from 'date-fns';
import { MongoClient, ObjectId } from 'mongodb';
export { insertDocument, get_transaction_by_state, getSellTrackerRecordsByQuery, get_transaction_by_date_and_state, insertSellTrackerDocument,  updateOpenOrderProfitAndLoss, getBuyTrackerRecordsByAddress, updateTransactionState, createOpenOrder, getBuyTrackerRecordByAddress, getOpenOrderRecordByAddress, getAllOpenOrders, deleteOpenOrder };

const uri: string = "mongodb+srv://tiagoluz92:F49IQWE3BhCQSQKL@sniperbot.neoqqnn.mongodb.net/?retryWrites=true&w=majority&appName=sniperbot";
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  authSource: "admin", // The database that handles authentication, typically "admin"
};
const client = new MongoClient(uri, options);

interface buy {
  _id: ObjectId;
  tx_date: string;
  tx_state: string;
  address: String;
  signature: string;
  symbol: String;
  usd_spent?: number;
  token_amount_received?: number;
  entry_price?: number;
}

interface OpenOrder {
  tx_date: string;
  address: String;
  symbol: String;
  usd_spent: number;
  entry_price: number;
  token_amount_received: number;
  stop_loss: number;
  TP_1: number;
  TP_2: number;
  price_change_percent?: string;
  profit_and_loss?: string;
}

interface SellTracker {
  _id: ObjectId;
  buy_date: Date;
  sell_date: Date;
  address: String;
  symbol: string;
  usd_received: number;
  token_amount_sold: number;
  entry_price: number;
  message: String;
  exit_price: number;
  profit_and_loss?: number;
}


async function deleteAllDocumentsFromCollection(collectionName: string) {
  try {
    await client.connect(); // Ensure the client is connected
    const database = client.db("sniperbot"); // Specify your database name
    const collection = database.collection(collectionName); // Specify the collection from which to delete documents

    const result = await collection.deleteMany({}); // An empty filter deletes all documents

    console.log(`${result.deletedCount} documents were deleted from the collection '${collectionName}'.`);
  } catch (error) {
    console.error('Error deleting documents:', error);
  } finally {
    await client.close(); // Close the connection
  }
}

async function insertSellTrackerDocument(sellData: any): Promise<void> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection('sell_tracker');
    await collection.insertOne(sellData);
    console.log(`Sell tracker document inserted successfully.`);
  } catch (error) {
    console.error('Error inserting sell tracker document:', error);
  } finally {
    await client.close();
  }
}

async function getAllOpenOrders(): Promise<OpenOrder[]> {
  try {
      await client.connect();
      const database = client.db("sniperbot");
      const collection = database.collection<OpenOrder>('open_orders');
      return await collection.find({}).toArray();
  } finally {
      await client.close();
  }
}

async function deleteOpenOrder(address: string): Promise<void> {
  try {
      await client.connect();
      const database = client.db("sniperbot");
      const collection = database.collection<OpenOrder>('open_orders');
      await collection.deleteOne({ address: address });
      console.log(`Deleted open order for address ${address}`);
  } finally {
      await client.close();
  }
}

async function getBuyTrackerRecordByAddress(address: string): Promise<buy | null> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection<buy>('buy_tracker');
    const record = await collection.findOne({ address: address });
    console.log(`Record found for address ${address} in buy_tracker:`, record);
    return record;
  } catch (error) {
    console.error('Error retrieving record from buy_tracker:', error);
    return null;
  } finally {
    await client.close();
  }
}

async function getBuyTrackerRecordsByAddress(address: string): Promise<buy[]> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection<buy>('buy_tracker');
    const records = await collection.find({ address: address }).toArray();
    console.log(`Records found for address ${address} in buy_tracker:`, records);
    return records;
  } catch (error) {
    console.error('Error retrieving records from buy_tracker:', error);
    return [];
  } finally {
    await client.close();
  }
}

async function getOpenOrderRecordByAddress(address: string): Promise<OpenOrder | null> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection<OpenOrder>('open_orders');
    const record = await collection.findOne({ address: address });
    console.log(`Record found for address ${address} in open_orders:`, record);
    return record;
  } catch (error) {
    console.error('Error retrieving record from open_orders:', error);
    return null;
  } finally {
    await client.close();
  }
}

async function createOpenOrder(order: OpenOrder): Promise<void> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection('open_orders');
    await collection.insertOne(order);
    console.log(`Open order for address ${order.address} created.`);
  } catch (error) {
    console.error('Error creating open order:', error);
  } finally {
    await client.close();
  }
}

async function insertDocument(doc: buy): Promise<void> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection<buy>('buy_tracker');
    const result = await collection.insertOne(doc);
    console.log(`A document was inserted with the _id: ${result.insertedId}`);
  } catch (error) {
    console.error('Error inserting document:', error);
  } finally {
    await client.close();
  }
}

async function get_transaction_by_state(ts_state: String): Promise<buy[]> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection<buy>('buy_tracker');
    const pendingTransactions = await collection.find({ tx_state: ts_state }).toArray();
    return pendingTransactions;
  } finally {
    await client.close();
  }
}


async function get_transaction_by_date_and_state(tx_state: string, tx_date: string): Promise<any[]> {
    // MongoDB connection URL

    try {
        // Connect to the MongoDB client
        await client.connect();
        const database = client.db("sniperbot");
        const collection = database.collection("buy_tracker");

        // Create a regex to search for dates that contain the tx_date string
        const dateRegex = new RegExp(tx_date);

        // Query to find records with the matching tx_state and a tx_date containing the tx_date string
        const query = { tx_state: tx_state, tx_date: { $regex: dateRegex } };

        // Fetching the records from the database
        const records = await collection.find(query).toArray();

        return records;
    } catch (error) {
        console.error("An error occurred while fetching records:", error);
        throw error;
    } finally {
        // Ensuring the MongoDB client closes connection after execution
        await client.close();
    }
}

async function testConnection() {
  try {
    await client.connect();
    console.log('Connected successfully to server');
  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    await client.close();
  }
}

async function updateTransactionState(
  transactionId: ObjectId, // Change to use ObjectId type
  newState: string, 
  usdSpent: number, 
  tokenReceived: number, 
  additionalFields: any
): Promise<void> {
  // Calculate entry price if transaction is completed and tokenReceived is greater than zero to avoid division by zero
  let entryPrice = newState === "completed" && tokenReceived > 0 ? usdSpent / tokenReceived : 0;

  // Merge additional fields with the base update document
  const updateDoc = {
    $set: {
      ...additionalFields,
      tx_state: newState,
      usd_spent: usdSpent,
      token_amount_received: tokenReceived,
      entry_price: entryPrice
    }
  };

  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection<buy>('buy_tracker');
    await collection.updateOne({ _id: transactionId }, updateDoc);
    console.log(`Transaction with _id ${transactionId} updated to ${newState} with entry price: ${entryPrice}`);
  } finally {
    await client.close();
  }
}

async function updateOpenOrderProfitAndLoss(address: string, updateFields: any): Promise<void> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection<OpenOrder>('open_orders');
    const updateResult = await collection.updateOne(
      { address: address },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      console.log(`No open order found with address ${address} to update.`);
    } else if (updateResult.modifiedCount === 0) {
      console.log(`Open order with address ${address} was found but not updated. It may already have the latest values.`);
    } else {
      console.log(`Open order with address ${address} updated.`);
    }
  } catch (error) {
    console.error('Error updating open order:', error);
  } finally {
    await client.close();
  }
}


async function getSellTrackerRecordsByQuery(query: any): Promise<SellTracker[]> {
  try {
    await client.connect();
    const database = client.db("sniperbot");
    const collection = database.collection<SellTracker>('sell_tracker');

    const records = await collection.find(query).toArray();

    console.log(`Records found in sell_tracker based on the provided query:`, records);
    return records;
  } catch (error) {
    console.error('Error retrieving records from sell_tracker based on query:', error);
    return [];
  } finally {
    await client.close();
  }
}

async function deleteAllRecords() {
  try {
    
    

    // Connect to MongoDB
    await client.connect();

    // Get the database and collection
    const database = client.db("sniperbot");
    const collection = database.collection<SellTracker>('buy_tracker');

    // Delete all documents in the collection
    const deleteResult = await collection.deleteMany({});

    console.log(`${deleteResult.deletedCount} documents deleted from the collection.`);

    // Close the connection
    await client.close();
  } catch (error) {
    console.error('Error deleting documents:', error);
  }
}

