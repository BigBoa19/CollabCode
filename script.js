let ws = null;
let roomId = "";
let userId = null; // Will be set by server
let lastContent = "";
let cursorPosition = 0;
let messagesSent = 0;
let messagesReceived = 0;

function updateStatus(message, connected) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${connected ? "connected" : "disconnected"}`;
}

function addMessage(content, type = "info") {
  const messages = document.getElementById("messages");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`;

  const timestamp = new Date().toLocaleTimeString();
  messageDiv.innerHTML = `
    <span class="timestamp">[${timestamp}]</span>
    ${content}
  `;

  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

function updateUserInfo() {
  document.getElementById("userId").textContent = userId || "Not connected";
  document.getElementById("currentRoom").textContent = roomId || "None";
  document.getElementById("connectionUrl").textContent = ws
    ? `ws://localhost:8080/ws/${roomId}`
    : "Not connected";
}

function connect() {
  roomId = document.getElementById("roomInput").value.trim();
  if (!roomId) {
    alert("Please enter a room ID");
    return;
  }

  const wsUrl = `ws://localhost:8080/ws/${roomId}`;
  addMessage(`🔌 Connecting to: ${wsUrl}`, "system");

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
      updateStatus(`✅ Connected to room: ${roomId}`, true);
      addMessage(`✅ Connected to room "${roomId}"`, "system");

      document.getElementById("connectBtn").disabled = true;
      document.getElementById("disconnectBtn").disabled = false;

      updateUserInfo();
    };

    ws.onmessage = function (event) {
      messagesReceived++;
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
        addMessage(
          `📨 Received: ${message.type} "${message.content}" at position ${message.position}`,
          "received"
        );
      } catch (error) {
        addMessage(`📨 Received: ${event.data}`, "received");
      }
    };

    ws.onclose = function (event) {
      updateStatus("❌ Disconnected", false);
      addMessage(`❌ Connection closed (Code: ${event.code})`, "system");

      document.getElementById("connectBtn").disabled = false;
      document.getElementById("disconnectBtn").disabled = true;

      updateUserInfo();
    };

    ws.onerror = function (error) {
      addMessage(`❌ WebSocket error: ${error}`, "system");
    };
  } catch (error) {
    addMessage(`❌ Connection failed: ${error.message}`, "system");
  }
}

function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

function sendMessage(type, content, position) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert("Not connected to WebSocket");
    return;
  }

  const message = {
    type: type,
    content: content,
    position: position,
    user_id: userId,
    timestamp: Date.now(),
  };

  ws.send(JSON.stringify(message));
  messagesSent++;
  addMessage(
    `📤 Sent: ${type} "${content}" at position ${position}`,
    "sent"
  );
}

function handleMessage(message) {
  if (message.type === "join") {
    // Server sent us our client ID
    userId = message.content;
    addMessage(`🆔 Assigned User ID: ${userId}`, "system");
    updateUserInfo();
  } else if (message.type === "insert") {
    insertTextAtPosition(message.content, message.position);
  } else if (message.type === "delete") {
    deleteTextAtPosition(message.content, message.position);
  }
}

function insertTextAtPosition(text, position) {
  const editor = document.getElementById("editor");
  const currentContent = editor.textContent;

  if (position >= 0 && position <= currentContent.length) {
    const newContent =
      currentContent.slice(0, position) +
      text +
      currentContent.slice(position);
    editor.textContent = newContent;
    lastContent = newContent;
  }
}

function deleteTextAtPosition(text, position) {
  const editor = document.getElementById("editor");
  const currentContent = editor.textContent;

  if (position >= 0 && position < currentContent.length) {
    const endPos = position + text.length;
    if (endPos <= currentContent.length) {
      const newContent =
        currentContent.slice(0, position) + currentContent.slice(endPos);
      editor.textContent = newContent;
      lastContent = newContent;
    }
  }
}

function handleEditorChange() {
  const editor = document.getElementById("editor");
  const currentContent = editor.textContent;

  if (currentContent !== lastContent) {
    // Simple diff - find what changed
    console.log("lastContent: ", lastContent)
    console.log("currentContent: ", currentContent)
    const diff = findDifference(lastContent, currentContent);
    console.log(diff)
    if (diff) {
      if (diff.type === "insert") {
        sendMessage("insert", diff.content, diff.position);
      } else if (diff.type === "delete") {
        sendMessage("delete", diff.content, diff.position);
      }
    }
    lastContent = currentContent;
  }
}

function findDifference(oldText, newText) {
  oldText = oldText.replace(/\u00A0/g, ' ');
  newText = newText.replace(/\u00A0/g, ' ');
  if (newText.length > oldText.length) { // Insertion
    let start = 0; let end = newText.length;
    let startFound = false;
    for (let i = 0; i < newText.length; i++) {
      if (newText[i] !== oldText[i] && !startFound) {
        console.log("new \n", newText[i])
        console.log("old \n", oldText[i])
        start = i;
        startFound = true;
      }  
      if (newText.slice(i) === oldText.slice(start)) end = i;
    }
    console.log(start, end)
    return {
      type: 'insert',
      content: newText.slice(start, Math.min(end, newText.length)),
      position: start
    }
  } else if (newText.length < oldText.length) { // Deletion
    let start = 0; let end = oldText.length;
    let startFound = false;
    for (let i = 0; i < oldText.length; i++) {
      if (newText[i] !== oldText[i] && !startFound) {
        start = i;
        startFound = true;
      }  
      if (oldText.slice(i) === newText.slice(start)) end = i;
    }
    return {
      type: 'delete',
      content: oldText.slice(start, Math.min(end, oldText.length)),
      position: start
    }
  }
  return null;
}

function updateCursorPosition() {
  const editor = document.getElementById("editor");
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    cursorPosition = range.startOffset;
  }
}

function manualInsert() {
  const text = document.getElementById("insertText").value;
  const position = parseInt(
    document.getElementById("insertPosition").value
  );

  if (text && position >= 0) {
    sendMessage("insert", text, position);
    insertTextAtPosition(text, position);
  }
}

function manualDelete() {
  const text = document.getElementById("deleteText").value;
  const position = parseInt(
    document.getElementById("deletePosition").value
  );

  if (text && position >= 0) {
    sendMessage("delete", text, position);
    deleteTextAtPosition(text, position);
  }
}

function testInsertSequence() {
  const testTexts = ["Hello", " World", "!", " This is a test"];
  let position = 0;

  testTexts.forEach((text, index) => {
    setTimeout(() => {
      sendMessage("insert", text, position);
      insertTextAtPosition(text, position);
      position += text.length;
    }, index * 1000);
  });
}

function testDeleteSequence() {
  const editor = document.getElementById("editor");
  const content = editor.textContent;

  if (content.length > 0) {
    // Delete from end
    const deleteText = content.slice(-1);
    const position = content.length - 1;
    sendMessage("delete", deleteText, position);
    deleteTextAtPosition(deleteText, position);
  }
}

function clearEditor() {
  const editor = document.getElementById("editor");
  editor.textContent = "";
  lastContent = "";
  addMessage("🧹 Editor cleared", "system");
}

function testMultipleConnections() {
  addMessage("🔄 Testing multiple connections...", "system");

  for (let i = 1; i <= 3; i++) {
    setTimeout(() => {
      const testWs = new WebSocket(
        `ws://localhost:8080/ws/${roomId || "test-room"}`
      );
      testWs.onopen = () => {
        addMessage(`📡 Test connection ${i} opened`, "system");
        setTimeout(() => {
          testWs.send(
            JSON.stringify({
              type: "insert",
              content: `Test ${i}`,
              position: 0,
              user_id: `test-user-${i}`,
              timestamp: Date.now(),
            })
          );
        }, 1000);
      };
    }, i * 500);
  }
}

function testRoomIsolation() {
  addMessage("🔒 Testing room isolation...", "system");

  const room1 = new WebSocket("ws://localhost:8080/ws/room-1");
  const room2 = new WebSocket("ws://localhost:8080/ws/room-2");

  room1.onopen = () => {
    addMessage("📡 Connected to room-1", "system");
    room1.send(
      JSON.stringify({
        type: "insert",
        content: "Room 1 message",
        position: 0,
        user_id: "room1-user",
        timestamp: Date.now(),
      })
    );
  };

  room2.onopen = () => {
    addMessage("📡 Connected to room-2", "system");
    room2.send(
      JSON.stringify({
        type: "insert",
        content: "Room 2 message",
        position: 0,
        user_id: "room2-user",
        timestamp: Date.now(),
      })
    );
  };
}

function clearMessages() {
  document.getElementById("messages").innerHTML = "";
  addMessage("🧹 Messages cleared", "system");
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  updateUserInfo();
  addMessage(
    "🚀 Collaborative Text Editor loaded. Ready to connect!",
    "system"
  );
});
