import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";

let active_file, lang, fpath, cmd_args;
let closed = false;
let det, d;
let msg;
let py, sh;
const con = readFileSync("test.html", {
  encoding: "utf8",
  flag: "r",
});
const httpServer = createServer((req, res) => {
  if (req.url !== "/") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  // reload the file every time
  const content = con;

  //const length = 3;
  const length = Buffer.byteLength(content);

  res.writeHead(200, {
    "Content-Type": "text/html",
    "Content-Length": length,
  });
  res.end(content);
});

function writeTo(c, path) {
  mkdirSync(path);
  for (let n = 0; n < c.length; n++) {
    writeFileSync(path + "/" + c[n]["file_name"], c[n]["code"]);
  }
}
function remove_dir() {
  rmSync(fpath, { recursive: true, force: true });
}
function dene() {
  if (!closed && msg) {
    sh.stdin.write(msg + "\n");
    msg = null;
  }
}

function terminalRun(sc) {
  //sh = spawn("python3", ["-i"]);
  sh = spawn("bash"); // linux komut satırı için
  //det = setInterval(dene, 200);

  // handle  output events
  sh.stdout.on("data", (data) => {
    d += 1;
    console.log(`stdout: ` /*${data}`*/);
    //let k = data.toString() + "\n";
    //let enc = new TextEncoder();
    //sc.emit("output", enc.encode(k));
    sc.emit("output", data);
  });

  sh.stderr.on("data", (data) => {
    sc.emit("err", data);
    console.error(`stderr: ${data}`);
  });

  sh.on("close", (code) => {
    //clearInterval(det);
    closed = true;
    sc.emit("exit", `\nchild process exited with code ${code}`, code);
    console.log(`child process exited with code ${code}`);
  });
}

function compileAndRun(sc) {
  let full_name = fpath + "/" + active_file;
  switch (lang) {
    case "c":
      sh = spawn(
        "/usr/bin/gcc",
        [
          full_name + " -o " + full_name + "uk && ./" + full_name + "uk",
          cmd_args,
        ],
        { shell: true }
      );
      break;
    case "cpp":
      sh = spawn(
        "/usr/bin/g++",
        [
          full_name + " -o " + full_name + "uk && ./" + full_name + "uk",
          cmd_args,
        ],
        { shell: true }
      );
      break;

    case "java":
      sh = spawn(lang, [fpath + "/" + active_file, cmd_args]);
      break;

    case "python3":
      sh = spawn(lang, [fpath + "/" + active_file, cmd_args]);
      break;

    default:
      break;
  }

  //det = setInterval(dene, 200);

  // handle  output events
  sh.stdout.on("data", (data) => {
    d += 1;
    console.log(`stdout: ${data}`);
    //let k = data.toString() + "\n";
    //let enc = new TextEncoder();
    //sc.emit("output", enc.encode(k));
    sc.emit("output", data);
  });

  sh.stderr.on("data", (data) => {
    sc.emit("err", data);
    console.error(`stderr: ${data}`);
  });

  sh.on("close", (code) => {
    //clearInterval(det);
    closed = true;
    remove_dir();
    sc.emit("exit", `\n ** child process exited with code ${code}`, code);
    console.log(`child process exited with code ${code}`, performance.now());
  });
}

const io = new Server(httpServer, {
  // Socket.IO options
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log(`connect ${socket.id}`, performance.now());
  console.log(socket.handshake.query.lang);
  fpath = socket.id;
  lang = socket.handshake.query.lang;
  if (socket.handshake.query.type == "shell") terminalRun(socket);

  socket.on("disconnect", (reason) => {
    console.log(`disconnect ${socket.id} due to ${reason}`, performance.now());
  });
  socket.on("code", (cod, cargs, act_file) => {
    active_file = act_file;
    cmd_args = cargs;
    writeTo(cod, socket.id);
    compileAndRun(socket);
  });
  socket.on("message", function (message) {
    msg = message;
    console.log(msg);
    //socket.emit("input", message);
    sh.stdin.write(msg);
  });
});

httpServer.listen(3000);

