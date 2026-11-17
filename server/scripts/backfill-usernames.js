import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set.');
const applyChanges = process.argv.includes('--apply');

await mongoose.connect(process.env.MONGODB_URI);
try {
  const users = await User.find({ $or: [{ username: { $exists: false } }, { username: null }, { username: '' }] }).select('_id name').lean();
  const phoneDuplicates = await User.aggregate([
    { $match: { phone: { $type: 'string' } } },
    { $group: { _id: '$phone', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'duplicateValues' },
  ]);
  const existing = new Set((await User.distinct('username', { username: { $type: 'string' } })).map((value) => value.toLowerCase()));
  const operations = [];
  for (const user of users) {
    const base = (user.name || 'wolflink_user').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 14) || 'wolflink_user';
    const idSuffix = user._id.toString().slice(-8);
    let candidate = `${base}_${idSuffix}`.slice(0, 24);
    let suffix = 1;
    while (existing.has(candidate)) {
      const extra = `_${idSuffix}${suffix++}`;
      candidate = `${base.slice(0, 24 - extra.length)}${extra}`;
    }
    existing.add(candidate);
    operations.push({ updateOne: { filter: { _id: user._id, $or: [{ username: { $exists: false } }, { username: null }, { username: '' }] }, update: { $set: { username: candidate } } } });
  }

  console.log(`${applyChanges ? 'Apply' : 'Dry run'}: ${operations.length} username(s) need backfill; ${phoneDuplicates[0]?.duplicateValues || 0} duplicate phone value(s) need remediation.`);
  if (applyChanges) {
    if (phoneDuplicates[0]?.duplicateValues) throw new Error('Resolve duplicate phone values before applying the unique phone index. No phone values were printed.');
    if (operations.length) {
      const result = await User.bulkWrite(operations, { ordered: false });
      console.log(`Updated ${result.modifiedCount} account(s).`);
    }
    await User.collection.createIndex({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
    await User.collection.createIndex({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
  } else if (!applyChanges) {
    console.log('No records changed. Rerun with --apply to write the collision-safe usernames.');
  }
} finally {
  await mongoose.disconnect();
}
