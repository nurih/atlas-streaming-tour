# MongoDB Atlas Stream Processor Tour

## Demo

1. Ensure network port open in Atlas for the host where you will run the shell. This may be your laptop. This is so you can run a local shell or Compass to interact with data.
1. Create a stream processing service instance. Click the **Create instance** button. I named mine **stream-processing-service**.
    > This only provisions the service. Noting runs until you start a processor, which spins up runtime(s) to execute.
1. Add a _source connection_ to the service - at least one is needed. Hit the **Configure** button, then the **Connection Registry** tab. The connection tells the service where stream events are coming from.
    |Connection | Purpose |
    |--- |--- |
    |`MyOutputGoesHere`| A connection for the final output of the stream processor. This is where data will end up.|
    |`MyInputComesFromHere`| A connection for the source stream events. This is where the stream processor picks up events.|
    |`sample_stream_solar` | A connection to a built in random sample event generator that simulates an IOT device. Usefull for testing and learning|

1. Using `mongosh` (version 2 or above), connect to the stream processor endpoint. To get the connection string, click the `Connect` button in Atlas under the **Connect** button, and grab the connection URL.
    > The shell connects to the Stream Processing Service, not the database cluster.

### In-Process Stream Consumption

A sample stream with events is available if you regiestered an example connection. It is named `sample_stream_solar`.

Executing a simple processor that consumes events and does nothing except output to the console can be run thusly:

```javascript

AtlasStreamProcessing> sp.process([{ "$source": { "connectionName": "sample_stream_solar" } }]) 

```

The output is periodic documents that look like this:

```json
{
  "device_id": "device_1",
  "group_id": 1,
  "timestamp": "2024-08-08T23:08:02.881+00:00",
  "max_watts": 450,
  "event_type": 0,
  "obs": {
    "watts": 6,
    "temp": 24
  },
  "_ts": ISODate("2024-08-08T23:08:02.881Z"),
  "_stream_meta": {
    "source": {
      "type": "generated"
    }
  }
}
```

The document has a mix of fields, some are pyaload and some are envelope.

The envelops fields are `_ts` and `_stream_meta`. These are set by the stream processor, and describe the timestamp the processor landed the event, as well details about the stream itself. If you have more than one source that emits the same payload fields, information in the `_stream_meta` will help you distinguish them.

### Long Running Processor

The code below shows the creation of a long-running processor. Once created, it will be running continuously.

> **This incurs billing!** As long as there is a processor instance running, billing will be ticking away.

The script below assumes the following:

1. A source stream named **sample_stream_solar**.
1. An output (sink) connection  named **MyOutputGoesHere**.
1. A database named **test** with an existing collection named **groupTempStatsFromStreamProcessor**.

```javascript
let sourceStream = {
  $source: {
    connectionName: "sample_stream_solar",
    timeField: {
      $dateFromString: {
        dateString: '$timestamp'
      }
    }
  }
}

let groupTemp = {
  $group: {
    _id: "$group_id",
    minTemp: {
      $min: "$obs.temp"
    },
    maxTemp: {
      $max: "$obs.temp"
    },
    avgTemp: {
      $avg: "$obs.temp"
    },
    stdevPTemp: {
      $stdDevPop: "$obs.temp"
    }
  }
}

let timeWindowPipeline = {
  $tumblingWindow: {
    interval: {
      size: NumberInt(3),
      unit: "second"
    },
    pipeline: [groupTemp]
  }
}

let finalOutput = {
  $merge: {
    into: {
      connectionName: "MyOutputGoesHere",
      db: "demo",
      coll: "groupTempStatsFromStreamProcessor"
    }
  }
}

let processor = sp.createStreamProcessor("myGroupTempStatsProcessor", [sourceStream, timeWindowPipeline, finalOutput])

```

If the above is successful, then a processor would be created and started. A long as your shell is still connected, the variable `processor` I defined is a handle to start or stop the instance itself. But a running processor is _not bound to the shell_. You can exit the shell and connect later. This is why the command `sp.getProcessor(PROCESSOR_NAME)` exists. It retrieves and allows you to interact with an existing processor.

Contorl of the processor lifetime can be excercised from the shell, as seen below:

```javascript
// get list of processors
sp.listStreamProcessors();

// This gets a processor object in the mongosh.
let myProcessor = sp.getProcessor('myGroupTempStatsProcessor');

// start a stopped / paused processor
myProcessor.start();

// stop / pause a running processor
myProcessor.stop();

// delete / drop a processor
myProcessor.drop();

```

## Dead Letter Queue

Data just appears in the output queue, processed to perfection. Yeah, right...

There can be a issues with event data coming from the input stream. If an event is consumed from the source, but cannot be processed to perfection, the stream processor needs to do something with it. This is especially apparent in case of late. If a source event is not processable, it would be wrong to include it in the window calculation. It would be dangerous to just ignore it. But the place for it is probably not the output stream. After all, who wants mangled data co-mingled with good data?

This is where the Dead Letter Queue (**DLQ**) comes in. DLQ lets you direct source events not matching expectations or otherwise unprocessable to a collection of your choice.

> Note a message is discarded to **DLQ** on a best effort basis. It is _not transactionally guaranteed_!

Check out the demo script in the [file named dlq.js](dlq.js)
