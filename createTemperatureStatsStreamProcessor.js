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
      db: "test",
      coll: "groupTempStatsFromStreamProcessor"
    }
  }
}

let processor = sp.createStreamProcessor("myGroupTempStatsProcessor", [sourceStream, timeWindowPipeline, finalOutput])