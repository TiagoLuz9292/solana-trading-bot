import { startOfDay, endOfDay, subHours, startOfHour, format } from 'date-fns';
import { MongoClient, ObjectId, Collection, Db } from 'mongodb';
import dotenv from "dotenv";

dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

export {
  insertWalletData, activateWallet_buyer, deactivateWallet_buyer, getWalletActivationStatus_buyer,
  findWalletByTelegramId, insertDocument, getHighPriceChangeOrders, get_transaction_by_state,
  deleteOldRecords, delete_buy_by_date, getSellTrackerRecordsByQuery, get_transaction_by_date_and_state,
  insertSellTrackerDocument, updateOpenOrderProfitAndLoss, getBuyTrackerRecordsByAddress, updateTransactionState,
  createOpenOrder, getBuyTrackerRecordByAddress, getOpenOrderRecordByAddress, getAllOpenOrders, deleteOpenOrder,
  addTaxesToPayToAllRecords
};



let database: Db | null = null;


let client: MongoClient | null = null;

// Asynchronously connects to the database and initializes it if not already done
export async function connectToDatabase(): Promise<MongoClient> {
  if (!client) {
      const uri = process.env.MONGO_DB_CONNECTION_STRING || '';
      client = new MongoClient(uri);
      await client.connect();
      console.log("MongoClient connected");
  }
  return client;
}

// Returns the database object for a specific database
export function getDatabase(dbName: string): Db {
  if (!client) {
      throw new Error("Database connection is not established. Call connectToDatabase first.");
  }
  return client.db(dbName);
}

process.on('SIGINT', async () => {
  if (client) {
      await client.close();
      console.log("MongoClient closed");
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (client) {
      await client.close();
      console.log("MongoClient closed");
  }
  process.exit(0);
});

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
  address: string;
  symbol: string;
  usd_received: number;
  token_amount_sold: number;
  entry_price: number;
  message: string;
  exit_price: number;
  profit_and_loss?: number;
}


export async function set_trade_mode_to_fixed(telegramId: string, db: Db): Promise<boolean> {
  try {
    const wallets = db.collection("tg_info");
    const result = await wallets.updateOne({ telegramId: telegramId }, { $set: { trade_value_mode: "fixed" } });
    return result.modifiedCount > 0;
  } catch (e) {
    console.error(`Failed to achange trade mode: ${e}`);
    return false;
  }
}

export async function set_trade_mode_to_percent(telegramId: string, db: Db): Promise<boolean> {
  try {
    const wallets = db.collection("tg_info");
    const result = await wallets.updateOne({ telegramId: telegramId }, { $set: { trade_value_mode: "percent" } });
    return result.modifiedCount > 0;
  } catch (e) {
    console.error(`Failed to achange trade mode: ${e}`);
    return false;
  }
}



export async function updateUserRecord(telegramId: string, fieldName: string, fieldValue: any, db: Db): Promise<void> {
  
  const collection = db.collection("tg_info");

  try {
      const result = await collection.updateOne(
          { telegramId: telegramId }, // Filter documents to find the document with the matching Telegram ID
          { $set: { [fieldName]: fieldValue } } // Use computed property names to set the field dynamically
      );

      if (result.matchedCount === 0) {
          console.log(`No document found with telegramId: ${telegramId}`);
      } else if (result.modifiedCount === 0) {
          console.log(`Document with telegramId: ${telegramId} was not updated. It may already have the value ${fieldValue}.`);
      } else {
          console.log(`Successfully updated the document with telegramId: ${telegramId}.`);
      }
  } catch (error) {
      console.error(`Error updating document for telegramId: ${telegramId}: ${error}`);
      throw error;
  }
}



export async function addNewPropertiesToAllRecords(db: Db): Promise<void> {
  const collection = db.collection('tg_info');
  
  try {
      const result = await collection.updateMany(
          {}, // filter to select all documents
          {
              $set: {
                  trade_value_mode: "percent"
                  
              }
          }
      );

      console.log(`Updated ${result.modifiedCount} documents.`);
  } catch (error) {
      console.error(`Failed to update documents: ${error}`);
      throw error;
  }
}

export async function resetTaxesToPay(telegramId: string, db: Db): Promise<void> {
  const collection = db.collection('tg_info');

  try {
    // Correct use of updateOne on the collection object
    const result = await collection.updateOne(
      { telegramId: telegramId }, // Filter to find the document
      { $set: { taxes_to_pay: 0 } } // Reset operation
    );

    if (result.matchedCount === 0) {
      console.error(`No document found with telegramId: ${telegramId}`);
    } else {
      console.log(`Successfully reset taxes_to_pay for telegramId: ${telegramId}`);
    }
  } catch (error) {
    console.error(`Failed to reset taxes_to_pay: ${error}`);
    throw error; // Optional: Re-throwing error might be omitted depending on error handling strategy
  }
}

export async function incrementTaxesToPay(tax_to_increment: number, telegramId: string, db: Db): Promise<void> {
  const collection = db.collection('tg_info');

  try {
      // Correct use of updateOne on the collection object
      const result = await collection.updateOne(
          { telegramId: telegramId }, // Filter to find the document
          { $inc: { taxes_to_pay: tax_to_increment } } // Increment operation
      );

      if (result.matchedCount === 0) {
          console.error(`No document found with telegramId: ${telegramId}`);
      } else {
          console.log(`Successfully incremented taxes_to_pay for telegramId: ${telegramId}`);
      }
  } catch (error) {
      console.error(`Failed to increment taxes_to_pay: ${error}`);
      throw error; // Optional: Re-throwing error might be omitted depending on error handling strategy
  }
}


export async function checkTelegramIdExists(telegramId: number, db: Db): Promise<boolean> {
  try {

    const accessListCollection = db.collection('access_list');
    
    const count = await accessListCollection.countDocuments({ telegramId }, { limit: 1 });
    return count > 0;
  } catch (error) {
    console.error("Failed to check Telegram ID in access list:", error);
    throw error;
  }
}

export async function addTelegramIdToAccessList(telegramId: number, db: Db) {
  try {
    
    const accessListCollection = db.collection('access_list');
    
    const result = await accessListCollection.insertOne({ telegramId });
    console.log(`Telegram ID ${telegramId} added to access list with result:`, result);
    
  } catch (error) {
    console.error("Failed to add Telegram ID to access list:", error);
    throw error;
  }
}


async function getWalletActivationStatus_buyer(telegramId: string, db: Db): Promise<boolean | null> {
  try {
    
    const wallets = db.collection("tg_info");
    const wallet = await wallets.findOne({ telegramId: telegramId }, { projection: { activated: 1 } });
    return wallet?.activated ?? null;
  } catch (e) {
    console.error(`Failed to get wallet activation status: ${e}`);
    return null;
  }
}

export async function getWalletActivationStatus_seller(telegramId: string, db: Db): Promise<boolean | null> {
  try {
    
    const wallets = db.collection("tg_info");
    const wallet = await wallets.findOne({ telegramId: telegramId }, { projection: { activated_seller: 1 } });
    return wallet?.activated_seller ?? null;
  } catch (e) {
    console.error(`Failed to get wallet activation status: ${e}`);
    return null;
  }
}


async function activateWallet_buyer(telegramId: string, db: Db): Promise<boolean> {
  try {
    const wallets = db.collection("tg_info");
    const result = await wallets.updateOne({ telegramId: telegramId }, { $set: { activated: true } });
    return result.modifiedCount > 0;
  } catch (e) {
    console.error(`Failed to activate wallet: ${e}`);
    return false;
  }
}
export async function activateWallet_seller(telegramId: string, db: Db): Promise<boolean> {
  try {
    const wallets = db.collection("tg_info");
    const result = await wallets.updateOne({ telegramId: telegramId }, { $set: { activated_seller: true } });
    return result.modifiedCount > 0;
  } catch (e) {
    console.error(`Failed to activate wallet: ${e}`);
    return false;
  }
}

async function deactivateWallet_buyer(telegramId: string, db: Db): Promise<boolean> {
  try {
    const wallets = db.collection("tg_info");
    const result = await wallets.updateOne({ telegramId: telegramId }, { $set: { activated: false } });
    return result.modifiedCount > 0;
  } catch (e) {
    console.error(`Failed to deactivate wallet: ${e}`);
    return false;
  }
}

export async function deactivateWallet_seller(telegramId: string, db: Db): Promise<boolean> {
  try {
    const wallets = db.collection("tg_info");
    const result = await wallets.updateOne({ telegramId: telegramId }, { $set: { activated_seller: false } });
    return result.modifiedCount > 0;
  } catch (e) {
    console.error(`Failed to deactivate wallet: ${e}`);
    return false;
  }
}



export async function findActiveWallets_for_buy(db: Db) {
  try {
    const wallets = db.collection("tg_info");

    // Log the entire collection to verify contents
    const allWallets = await wallets.find({}).toArray();
    console.log("All Wallets in tg_info collection:", allWallets);

    // Perform the query to find activated wallets
    const activeWallets = await wallets.find({ activated: true }).toArray();
    console.log("Queried Active Wallets:", activeWallets);

    return activeWallets;
  } catch (e) {
    console.error(`Failed to find active wallets: ${e}`);
    return [];
  }
}

export async function findActiveWallets_for_sell(db: Db) {
  try {
    const wallets = db.collection("tg_info");

    // Log the entire collection to verify contents
    const allWallets = await wallets.find({}).toArray();
    console.log("All Wallets in tg_info collection:", allWallets);

    // Perform the query to find activated wallets
    const activeWallets = await wallets.find({ activated_seller: true }).toArray();
    console.log("Queried Active Wallets:", activeWallets);

    return activeWallets;
  } catch (e) {
    console.error(`Failed to find active wallets: ${e}`);
    return [];
  }
}

export async function findAllWallets(db: Db) {
  try {
    const wallets = db.collection("tg_info");
    return await wallets.find().toArray();
  } catch (e) {
    console.error(`Failed to retrieve all wallets: ${e}`);
    return [];
  }
}

async function findWalletByTelegramId(telegramId: string, db: Db) {
  try {
    const wallets = db.collection("tg_info");
    return await wallets.findOne({ telegramId: telegramId });
  } catch (e) {
    console.error(`Failed to find wallet by Telegram ID: ${e}`);
    return null;
  }
}

async function insertWalletData(telegramId: string, walletAddress: string, encryptedSecretKey: string, db: Db) {
  try {
    const wallets = db.collection("tg_info");
    const result = await wallets.insertOne({
      telegramId,
      walletAddress,
      secretKey: encryptedSecretKey,
      activated_buyer: false, // Default value for the "activated" property
      activated_seller: false,
      taxes_to_pay: 0,   // Default value for the "taxes_to_pay" property
      account_percent_to_invest: 0.03, // Default value for account investment percentage
      take_profit_1_amount: 0.7,       // Default value for take profit 1
      take_profit_2_amount: 1,          // Default value for take profit 2
      auto_pause_percent: 0.5
    });
    console.log(`New wallet record inserted with the following id: ${result.insertedId}`);
  } catch (e) {
    console.error(`Failed to insert wallet data: ${e}`);
  }
}

async function deleteAllDocumentsFromCollection(collectionName: string, db: Db) {
  try {
    const collection = db.collection(collectionName);
    const result = await collection.deleteMany({});
    console.log(`${result.deletedCount} documents were deleted from the collection '${collectionName}'.`);
  } catch (error) {
    console.error('Error deleting documents:', error);
  }
}

async function insertSellTrackerDocument(sellData: any, db: Db): Promise<void> {
  try {
    const collection = db.collection('sell_tracker');
    await collection.insertOne(sellData);
    console.log(`Sell tracker document inserted successfully.`);
  } catch (error) {
    console.error('Error inserting sell tracker document:', error);
  }
}

async function getAllOpenOrders(db: Db): Promise<OpenOrder[]> {
  try {
    const collection: Collection<OpenOrder> = db.collection('open_orders');
    return await collection.find({}).toArray();
  } catch (error) {
    console.error('Error getting all open orders:', error);
    return [];
  }
}

async function deleteOpenOrder(address: string, db: Db): Promise<void> {
  try {
    const collection: Collection<OpenOrder> = db.collection('open_orders');
    await collection.deleteOne({ address: address });
    console.log(`Deleted open order for address ${address}`);
  } catch (error) {
    console.error('Error deleting open order:', error);
  }
}

async function getBuyTrackerRecordByAddress(address: string, db: Db): Promise<buy | null> {
  try {
    const collection: Collection<buy> = db.collection('buy_tracker');
    const record = await collection.findOne({ address: address });
    console.log(`Record found for address ${address} in buy_tracker:`, record);
    return record;
  } catch (error) {
    console.error('Error retrieving record from buy_tracker:', error);
    return null;
  }
}

async function getBuyTrackerRecordsByAddress(address: string, db: Db): Promise<buy[]> {
  try {
    const collection: Collection<buy> = db.collection('buy_tracker');
    const records = await collection.find({ address: address }).toArray();
    console.log(`Records found for address ${address} in buy_tracker:`, records);
    return records;
  } catch (error) {
    console.error('Error retrieving records from buy_tracker:', error);
    return [];
  }
}

async function getOpenOrderRecordByAddress(address: string, db: Db ): Promise<OpenOrder | null> {
  try {
    
    const collection: Collection<OpenOrder> = db.collection('open_orders');
    const record = await collection.findOne({ address: address });
    console.log(`Record found for address ${address} in open_orders:`, record);
    return record;
  } catch (error) {
    console.error('Error retrieving record from open_orders:', error);
    return null;
  }
}

async function createOpenOrder(order: OpenOrder, db: Db): Promise<void> {
  try {
    
    const collection: Collection<OpenOrder> = db.collection('open_orders');
    await collection.insertOne(order);
    console.log(`Open order for address ${order.address} created.`);
  } catch (error) {
    console.error('Error creating open order:', error);
  }
}

async function insertDocument(doc: buy, db: Db): Promise<void> {
  try {
    
    const collection: Collection<buy> = db.collection('buy_tracker');
    const result = await collection.insertOne(doc);
    console.log(`A document was inserted with the _id: ${result.insertedId}`);
  } catch (error) {
    console.error('Error inserting document:', error);
  }
}

async function get_transaction_by_state(ts_state: string, db: Db): Promise<buy[]> {
  try {
    
    const collection: Collection<buy> = db.collection('buy_tracker');
    const pendingTransactions = await collection.find({ tx_state: ts_state }).toArray();
    return pendingTransactions;
  } catch (error) {
    console.error('Error getting transaction by state:', error);
    return [];
  }
}

async function get_transaction_by_date_and_state(tx_state: string, tx_date: string, db: Db): Promise<any[]> {
  try {
    
    const collection = db.collection("buy_tracker");

    const dateRegex = new RegExp(tx_date);
    const query = { tx_state: tx_state, tx_date: { $regex: dateRegex } };

    const records = await collection.find(query).toArray();
    return records;
  } catch (error) {
    console.error("An error occurred while fetching records:", error);
    throw error;
  }
}

async function updateTransactionState(
  transactionId: ObjectId,
  newState: string,
  usdSpent: number,
  tokenReceived: number,
  additionalFields: any, db: Db
): Promise<void> {
  let entryPrice = newState === "completed" && tokenReceived > 0 ? usdSpent / tokenReceived : 0;

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
    
    const collection: Collection<buy> = db.collection('buy_tracker');
    await collection.updateOne({ _id: transactionId }, updateDoc);
    console.log(`Transaction with _id ${transactionId} updated to ${newState} with entry price: ${entryPrice}`);
  } catch (error) {
    console.error('Error updating transaction state:', error);
  }
}

async function updateOpenOrderProfitAndLoss(address: string, updateFields: any, db: Db): Promise<void> {
  
  
  try {
   
    const collection: Collection<OpenOrder> = db.collection('open_orders');
    const updateResult = await collection.updateOne(
      { address: address },
      { $set: updateFields }
    );
    

  } catch (error) {
    console.error('Error updating open order:', error);
  }
}

async function getSellTrackerRecordsByQuery(query: any, db: Db): Promise<SellTracker[]> {
  try {
    
    const collection: Collection<SellTracker> = db.collection('sell_tracker');

    const records = await collection.find(query).toArray();
    console.log(`Records found in sell_tracker based on the provided query:`, records);
    return records;
  } catch (error) {
    console.error('Error retrieving records from sell_tracker based on query:', error);
    return [];
  }
}

async function deleteOldRecords(db: Db) {
  try {
    const collection = db.collection('buy_tracker');

    // Get today's date in dd-mm-yyyy format
    const today = format(new Date(), 'dd-MM-yyyy');
    
    // Create the filter to check if the tx_date does not include today's date
    const filter = { tx_date: { $not: { $regex: today } } };

    const result = await collection.deleteMany(filter);
    console.log(`${result.deletedCount} records deleted.`);
  } catch (error) {
    console.error('Error deleting old records:', error);
  }
}

async function delete_buy_by_date(tx_date: string, db: Db): Promise<number> {
  try {
    
    const collection = db.collection("buy_tracker");

    const dateRegex = new RegExp(tx_date);
    const query = { tx_date: { $regex: dateRegex } };

    const result = await collection.deleteMany(query);
    return result.deletedCount;
  } catch (error) {
    console.error("An error occurred while deleting records:", error);
    throw error;
  }
}

async function getHighPriceChangeOrders(db: Db): Promise<any[] | undefined> {
  try {
    
    const openOrders = db.collection("open_orders");

    const pipeline = [
      {
        $addFields: {
          price_change_percent_float: {
            $convert: {
              input: { $replaceAll: { input: "$price_change_percent", find: ",", replacement: "" } },
              to: "double",
              onError: 0
            }
          }
        }
      },
      {
        $match: {
          price_change_percent_float: { $gt: 1750 }
        }
      }
    ];

    const results = await openOrders.aggregate(pipeline).toArray();
    return results;
  } catch (err) {
    console.error("Failed to retrieve records:", err);
    return undefined;
  }
}

async function addTaxesToPayToAllRecords(db: Db) {
  try {
    const wallets = db.collection("tg_info");

    const result = await wallets.updateMany(
      {}, // Filter to match all documents
      { $set: { taxes_to_pay: 0 } } // Update operation to add the new field
    );

    console.log(`Modified ${result.modifiedCount} documents to add taxes_to_pay with value 0`);
  } catch (e) {
    console.error(`Failed to update records: ${e}`);
  }
}