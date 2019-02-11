Mplex Benchmarks
==========

Benchmarks for both pull-mplex and libp2p-mplex

## Setup

1. `npm install`

## Tests

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
benchPingPong*100: 8382.416ms
benchPingPong*100: 8384.485ms
$ node bench.js --lib=libp2p-mplex
benchPingPong*100: 9571.866ms
benchPingPong*100: 10309.212ms
benchPingPong*100: 10629.806ms
benchPingPong*100: 10558.181ms
benchPingPong*100: 10839.580ms
```
