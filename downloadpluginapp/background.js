// 导入 JSZip 库
importScripts('jszip.min.js');

chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('插件被点击，当前标签页:', tab.id);
    
    if (!tab.url.startsWith('http')) {
      console.error('不支持的页面类型:', tab.url);
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    console.log('内容脚本注入成功');

    await chrome.tabs.sendMessage(tab.id, { 
      action: "downloadVisibleImages",
      tabId: tab.id 
    });
    console.log('已发送下载命令到内容脚本');

  } catch (error) {
    console.error('执行过程中出错:', error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request);
  if (request.action === "compressAndDownload") {
    compressAndDownload(request.images, request.timestamp)
      .then(() => {
        console.log('压缩和下载完成');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('压缩和下载失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function compressAndDownload(images, timestamp) {
  try {
    // 创建 ZIP 文件
    const zip = new JSZip();
    const imgFolder = zip.folder("images");
    
    // 添加图片到 ZIP
    for (const img of images) {
      const base64Data = img.data.split(',')[1];
      const binaryData = atob(base64Data);
      const array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
      }
      imgFolder.file(img.filename, array);
    }
    
    // 生成 ZIP 文件
    const zipBlob = await zip.generateAsync({
      type: "base64",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9
      }
    });
    
    // 下载 ZIP 文件
    await chrome.downloads.download({
      url: 'data:application/zip;base64,' + zipBlob,
      filename: `images_${timestamp}.zip`,
      saveAs: true
    });
    
  } catch (error) {
    console.error('压缩下载过程出错:', error);
    throw error;
  }
} 