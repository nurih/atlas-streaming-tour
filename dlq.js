
const OUTPUT_CONNECTION = "MyOutputGoesHere"
const DB_NAME = "demo"
const GOOD_ONES = "theGoodOnes"
const BAD_ONES = "theBadOnes"
const PROCESSOR_NAME = "myDlqDemoProcessor"

let processor = sp.getProcessor(PROCESSOR_NAME)

try {
  processor.stop();
  print(`Dropped "${PROCESSOR_NAME}"...`);
}
catch (e) { print(`Can't stop "${PROCESSOR_NAME}"...`) }
try {
  processor.drop();
  print(`Dropped "${PROCESSOR_NAME}"...`);
}
catch (e) { print(`Can't drop "${PROCESSOR_NAME}"...`) }

let mockDocs = [
  { x: 0 }, // small
  { x: 1 },
  { x: 3.14 }, // non-int
  { x: 2 },
  { x: "22" }, // non-int
  { x: 3 },
  { text: 'yo' }, // non-existent
  { x: 4 },
]

/***
 * Set up pipeline stages
 */

// An inline source of documents from the mock documents array
let sourceStream = {
  $source: {
    documents: mockDocs
  }
}


// validation
let documentValidator = {
  $validate: {
    validator: {
      $jsonSchema: {
        required: ["x"],
        properties: {
          x: {
            bsonType: "int",
            minimum: 1,
            maximum: 42,
            description: "Valid 'x' is an int in range [1,42]"
          }
        }
      }
    },
    validationAction: "dlq"
  }
}

// Window Function
let calculate = {
  $tumblingWindow: {
    interval: {
      size: NumberInt(3),
      unit: "second"
    },
    pipeline: [
      {
        $group: {
          _id: "allOfThem",
          theSum: { $sum: "$x" },
          theValues: { $push: "$x" }
        }
      }
    ]
  }
}

// direct output to a collection 
let finalOutput = {
  $merge: {
    into: {
      connectionName: OUTPUT_CONNECTION,
      db: DB_NAME,
      coll: GOOD_ONES
    },
    whenMatched: "replace",
    whenNotMatched: "insert"
  }
}

let processorOptions = {
  dlq: {
    // dead letter queue definition:
    connectionName: OUTPUT_CONNECTION,
    db: DB_NAME,
    coll: BAD_ONES
  }
}

let create = () => sp.createStreamProcessor(
  PROCESSOR_NAME,
  [sourceStream, documentValidator, calculate, finalOutput],
  processorOptions
);

// Start it:
// processor = create(); processor.start(); 

// Or: 
// create().start();