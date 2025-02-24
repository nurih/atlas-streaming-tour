
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
  { d: ISODate('2000-04-01T00:00:01'), x: 0 }, // small
  { d: ISODate('2000-04-01T00:00:02'), x: 1 },
  { d: ISODate('2000-04-01T00:00:03'), x: 3.14 }, // non-int
  { d: ISODate('2000-04-01T00:00:04'), x: 2 },
  { d: ISODate('2000-04-01T00:00:05'), x: "22" }, // non-int
  { d: ISODate('2000-04-01T00:00:06'), x: 3 },
  { d: ISODate('2000-04-01T00:00:07'), text: 'yo' }, // non-existent
  { d: ISODate('2000-04-01T00:00:08'), x: 4 },
]

/***
 * Set up pipeline stages
 */

// An inline source of documents from the mock documents array
let sourceStream = {
  $source: {
    documents: mockDocs,
    timeField: '$d' // the field containing the event time reference. Necessary for closing the window.
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
    idleTimeout: { size: 1, unit: "second" },
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