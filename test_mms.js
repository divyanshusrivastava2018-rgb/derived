const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  try {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    console.log("Memory server started at", uri);
    await mongod.stop();
  } catch (error) {
    console.error("Error:", error);
  }
})();
