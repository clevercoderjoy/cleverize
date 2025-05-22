document.getElementById("summarize").addEventListener("click", () => {
  const resultDiv = document.getElementById("result");
  const summaryType = document.getElementById("summary-type").value;

  resultDiv.innerHTML = '<div class="loader"></div>';

  chrome.storage.sync.get(["geminiApiKey"], ({ geminiApiKey }) => {
    if (!geminiApiKey) {
      resultDiv.textContent =
        "No API is set. Reload the extension to add your gemini API key.";
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: "GET_ARTICLE_TEXT" },
        async ({ text }) => {
          if (!text) {
            resultDiv.textContent = "Could not extract text from this page.";
            return;
          }
          try {
            const summary = await getGeminiSummary(
              text,
              summaryType,
              geminiApiKey
            );
            const formatted = formatGeminiSummary(summary);
            resultDiv.innerHTML = formatted;
          } catch (error) {
            resultDiv.textContent = "Gemini API error " + error.message;
          }
        }
      );
    });
  });
});

async function getGeminiSummary(text, summaryType, geminiApiKey) {
  const promptMap = {
    brief: `Give a short summary of this text:/n/n${text}.`,
    detailed: `Give a detailed summary of this text:/n/n${text}.`,
    bullets: `Summarize this text in a few bullet points:/n/n${text}.`,
  };
  const prompt = promptMap[summaryType] || promptMap.bullets;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5 },
      }),
    }
  );
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error?.message || "Request Failed");
  }
  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ??
    "No Clever Summary Available."
  );
}

document.getElementById("copy").addEventListener("click", () => {
  const text = document.getElementById("result").innerText;
  if (!text) {
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("copy");
    const old = btn.textContent;
    btn.textContent = "copied";
    setTimeout(() => {
      btn.textContent = old;
    }, 1000);
  });
});

function formatGeminiSummary(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  let html = "";
  let inList = false;

  lines.forEach((line) => {
    const bulletMatch = /^(\*|-|•)\s+/.test(line);

    if (bulletMatch) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      const bulletText = line.replace(/^(\*|-|•)\s+/, "");
      html += `<li>${boldify(bulletText)}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<p>${boldify(line)}</p>`;
    }
  });

  if (inList) html += "</ul>";

  return html;
}

function boldify(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function cleanSummary(rawText) {
  return rawText
    .replace(/\r/g, "") // remove carriage returns
    .replace(/\t+/g, " ") // tabs to space
    .replace(/\n{2,}/g, "\n") // multiple newlines to single
    .replace(/[ ]{2,}/g, " ") // multiple spaces to single
    .split("\n") // split lines
    .map((line) => line.trim()) // trim each line
    .filter((line) => line.length > 0) // remove empty lines
    .join("\n"); // rejoin cleanly
}
