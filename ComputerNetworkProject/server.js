const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = 12000;

// 파일 업로드를 위한 multer 설정
const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

app.use(express.static('public'));

// 파일 목록과 사용자 목록을 담을 변수
let fileList = [];
let users = [];

// 클라이언트 연결 처리
io.on('connection', (socket) => {
  // 클라이언트 연결 시 현재 파일 목록 및 사용자 목록 전송
  socket.emit('fileList', fileList);
  socket.emit('userList', users);

  // 클라이언트로부터 사용자 이름 설정
  socket.on('setUsername', (username) => {
  // 사용자 이름이 유효한지 확인
    if (username && !users.includes(username)) {
      socket.username = username;
      users.push(username);
      console.log(`${username} joined the chat`);

      // 사용자 목록 업데이트
      io.emit('userList', users);

      // 채팅 입장 메시지를 모든 클라이언트에게 방송
      io.emit('chat message', {
        username: 'system',
        message: `${username}님께서 입장하셨습니다.`
      });
    }  else {
      if (!username || username.trim() === '') {
        // 사용자 이름이 빈 문자열이거나 공백인 경우
        socket.emit('usernameError', '사용자 이름을 입력하세요.');
      } else {
        // 사용자 이름이 이미 존재하는 경우
        socket.emit('usernameError', '이미 사용 중인 이름입니다. 다른 이름을 입력하세요.');
      }
    }
  });


  // 클라이언트로부터 메시지 수신 시 처리
  socket.on('chat message', (message) => {
    // 받은 메시지를 모든 클라이언트에게 방송
    io.emit('chat message', {
      username: socket.username,
      message
    });
  });

  // 클라이언트 연결 해제 처리
  socket.on('disconnect', () => {
    if (socket.username) {
      console.log(`${socket.username} left the chat`);
      users = users.filter(user => user !== socket.username);

      // 사용자 목록 업데이트
      io.emit('userList', users);

      // 채팅 퇴장 메시지를 모든 클라이언트에게 방송
      io.emit('chat message', {
        username: 'system',
        message: `${socket.username}님께서 나가셨습니다.`
      });
    }
  });

  // 파일 업로드를 처리하는 라우트 핸들러
  app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    console.log('File uploaded:', file.filename);

    // 업로드된 파일 정보를 fileList에 추가
    fileList.push(file.filename);

    // 업로드된 파일 정보를 클라이언트에게 방송
    io.emit('file uploaded', {
      username: req.body.username,
      filename: file.filename,
      filetype: checkImage(file)
    });

    res.send('File uploaded successfully.');
  });
});

// 파일 다운로드를 처리하는 라우트 핸들러
app.get('/download', (req, res) => {
  const filename = req.query.filename;
  const filePath = path.join(__dirname, 'public/uploads', filename);

  res.download(filePath, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(500).send('Error downloading file.');
    }
  });
});

// 파일 목록을 보여주는 라우트 핸들러
app.get('/filelist.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'filelist.html'));
});

// 이미지 파일 확장자 확인 함수
function checkImage(file) {
  const fileLength = file.filename.length;
  const lastDot = file.filename.lastIndexOf('.');
  const extension = file.filename.substring(lastDot, fileLength).toLowerCase();
  const imageExtension = ['.bmp', '.jpeg', '.jpg', '.png', '.gif'];

  return imageExtension.includes(extension) ? 'image' : 'others';
}

server.listen(port, () => {
  console.log(`Chat server is running on port ${port}`);
});
