let sourceStream = {
  $source: {
    connectionName: "MyInputComesFromHere",
    db: "demo",
    coll: "atlasToAtlasIn",
    config: {
      "fullDocument": "required",
    }
  },
}


let calculate = {
  $tumblingWindow: {
    interval: { size: NumberInt(3), unit: "second" },
    pipeline: [
      {
        $group: {
          _id: "$fullDocument.color",
          n: {
            $sum: "$fullDocument.x"
          },
          series: { $push: '$fullDocument.x' }
        }
      }]
  }
}

let finalOutput = {
  $merge: {
    into: {
      connectionName: "MyOutputGoesHere",
      db: "demo",
      coll: "atlasToAtlasOut"
    }
  }
}

let create = () => sp.createStreamProcessor(
  "myAtlasToAtlasProcessor",
  [sourceStream, calculate, finalOutput]
);

print(`
// in this shell, connected to the stream processing service, run:
p = create()
p.start()


// To trigger the operation, add some docs to the source collection:
use demo;

docs = [
  {color:'red', x:1},
  {color:'red', x:2},
  {color:'blue', x:4},
  {color:'white', x:8},
  {color:'black', x:256},
  {color:'green', x:32},]

db.atlasToAtlasIn.insertMany(docs);
`)