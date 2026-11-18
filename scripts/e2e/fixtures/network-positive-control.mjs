import assert from "node:assert/strict";
import { lookup } from "node:dns/promises";
import { connect } from "node:net";
import { createSocket } from "node:dgram";

// The private fixture resolver logs this reserved name. The address is TEST-NET-1,
// and the container only has the test bridge. No live target is needed.
await assert.rejects(lookup("observer-control.invalid."));
await new Promise((resolve) => {
  const socket = connect({ host: "192.0.2.87", port: 443 });
  socket.once("error", resolve);
  socket.setTimeout(1500, () => socket.destroy(new Error("Fixture timeout")));
});

const datagram = createSocket("udp4");
try {
  await new Promise((resolve, reject) => {
    datagram.send(Buffer.from("fixture"), 38991, "127.0.0.1", (error) =>
      error ? reject(error) : resolve(),
    );
  });
} finally {
  datagram.close();
}
