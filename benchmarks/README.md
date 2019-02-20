Mplex Benchmarks
==========

Benchmarks for both pull-mplex and libp2p-mplex

## Setup

1. `npm install`

## Tests

**Note**: If additional profiling is needed on the benchmarks, [clinicjs](https://clinicjs.org/documentation/) can
be used in conjunction with the benchmark commands listed below.

### Echo with New Streams
This test will send a ping message from the dialer to the listener, which is echo'd back to the dialer.
A new stream will be created for each echo.

All flags can be omitted aside from `--lib`. The defaults are shown here for reference.
**pull-mplex**: `node bench.js --lib=pull-mplex --sends=1000 --repeat=100 --runs=3`
**libp2p-mplex**: `node bench.js --lib=libp2p-mplex --sends=1000 --repeat=100 --runs=3`

You should see results like:
```sh
$ node bench.js --lib=pull-mplex
benchPingPong*100: 8027.089ms
benchPingPong*100: 7544.150ms
benchPingPong*100: 7553.991ms
$ node bench.js --lib=libp2p-mplex
benchPingPong*100: 9571.866ms
benchPingPong*100: 10309.212ms
benchPingPong*100: 10629.806ms

```

### Write Large Files
This test will send the contents of a large file. The recipient will echo the file back to the dialer.

**Setup**: Before running the large file benchmark you will need to create the files. You can do this by running ```npm run setup```.

All flags can be omitted aside from `--lib`. The defaults are shown here for reference.
**pull-mplex**: `node large-file.js --lib=pull-mplex --repeat=1 --runs=3`
**libp2p-mplex**: `node large-file.js --lib=libp2p-mplex --repeat=1 --runs=3`

```sh
$ node large-file.js --lib=pull-mplex --repeat=1 --runs=3
sendFile*1: 379.209ms
sendFile*1: 291.188ms
sendFile*1: 314.664ms
$ node large-file.js --lib=libp2p-mplex --repeat=1 --runs=3
sendFile*1: 516.938ms
sendFile*1: 450.578ms
sendFile*1: 433.172ms
```
