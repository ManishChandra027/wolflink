import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB connection error (${error.name}).`);
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.info('MongoDB connected.');
}

export function getDatabaseStatus() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}
