const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { Configuration, OpenAIApi } = require("openai");

let strangerMessage = [];
let allUserMessages = [];

const openaiSecrets = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/secrets/openai.json"))
);

const configuration = new Configuration({
  apiKey: openaiSecrets.api_key,
});
const openai = new OpenAIApi(configuration);

const load = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("http://www.buzzr.com.br/chat.html");

  const newMessage = async () => {
    console.log(allUserMessages[allUserMessages.length - 1]);
    const { description, name } = JSON.parse(
      fs.readFileSync(path.join(__dirname, "/datas.json"), "utf8")
    );
    let text = `${description}`;
    for (let message of allUserMessages) {
      text += `\n${message}`;
    }
    text += `\n${name}:`;

    const { data } = await openai.createCompletion("text-davinci-001", {
      prompt: text,
      temperature: 0,
      max_tokens: 60,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
      stop: ["\n"],
    });

    let AiMessage = data.choices[0].text;
    let AiMessageArr = AiMessage.split("\n");

    if (AiMessageArr.length > 0) {
      for (let messageStr of AiMessageArr) {
        if (messageStr.length > 0) {
          if (messageStr.indexOf("Adolescente: ") !== -1) {
            messageStr = messageStr.substring(
              messageStr.indexOf("Adolescente: ") + "Adolescente: ".length,
              messageStr.length
            );
          }
          if (messageStr.indexOf("Estranho: ") === -1) {
            sendMessage(messageStr, name);
          }
        }
      }
    } else {
      stopChat();
    }
  };

  const stopChat = async () => {
    console.log("Stopping chat");
    await page.evaluate(() => {
      document
        .querySelectorAll(".btn.btn-default.chatstuffarea.buttonmargin")
        ["1"].click();
    });
    await browser.close();
    process.exit();
  };

  const sendMessage = async (message, name) => {
    await page.focus(".chattext");
    await page.keyboard.type(message, { delay: 150 });
    await page.evaluate(() => {
      document
        .querySelectorAll(".btn.btn-default.chatstuffarea.buttonmargin")
        ["0"].click();
    });
    allUserMessages.push(name + ":" + message);
    console.log(name + ":" + message);
    return;
  };

  setInterval(async () => {
    const { allMessages } = await page.evaluate(() => {
      const allDivs = document.querySelectorAll(".theirmsg");
      const allMessages = [];
      for (let key in allDivs) {
        if (
          allDivs[key] &&
          allDivs[key].innerText &&
          allDivs[key].innerText !== "Estranho: "
        ) {
          allMessages.push(allDivs[key].innerText);
        }
      }
      return {
        allMessages: allMessages,
      };
    });

    for (let message of allMessages) {
      if (!message.split(":")[1] || message.split(":")[1].length > 1) {
        if (
          allMessages[allMessages.length - 1] !==
          strangerMessage[strangerMessage.length - 1]
        ) {
          strangerMessage = allMessages;
          allUserMessages.push(allMessages[allMessages.length - 1]);
          newMessage();
        } else if (allMessages.length === 0) {
          strangerMessage = [];
          allUserMessages = [];
        }
      }
    }
  }, 1000);

  setInterval(async () => {
    await page.evaluate(() => {
      const systemMessages = document.querySelectorAll(".sysmsg");
      const newChatBtn = document.querySelector(".btn-default.nextbtn");

      for (let key in systemMessages) {
        if (systemMessages[key].innerText === "A conversa foi encerrada.") {
          newChatBtn.click();
        }
      }
    });
  }, 1000);
};

load();