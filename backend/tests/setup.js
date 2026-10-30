const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let replset;

// Start in-memory MongoDB before all tests
beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  const uri = replset.getUri();
  await mongoose.connect(uri);
});

// Clean all collections between test files
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Tear down after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await replset.stop();
});
