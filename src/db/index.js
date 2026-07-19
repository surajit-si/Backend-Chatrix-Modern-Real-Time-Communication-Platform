import mongoose from "mongoose";
import { DB_NAME } from "../../constants.js";

async function connectDB() {
  try {
    const connectionInstence = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`,
    );
    // console.log(connectionInstence.connection.host);
  } catch (error) {
    process.exit(1);
  }
}

export default connectDB;
