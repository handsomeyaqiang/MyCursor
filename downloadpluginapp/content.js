console.log('内容脚本已加载');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('内容脚本收到消息:', request);
  
  if (request.action === "downloadVisibleImages") {
    try {
      console.log('开始处理下载请求');
      processVisibleImages();
      sendResponse({ success: true });
    } catch (error) {
      console.error('处理下载请求时出错:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});

function isElementInViewport(el) {
  try {
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    return (
      rect.top >= -rect.height &&
      rect.left >= -rect.width &&
      rect.bottom <= windowHeight + rect.height &&
      rect.right <= windowWidth + rect.width
    );
  } catch (error) {
    console.error('检查元素可见性时出错:', error);
    return false;
  }
}

function isValidImageUrl(url) {
  if (!url) return false;
  
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const urlLower = url.toLowerCase();
  
  return (
    url.startsWith('data:image/') ||
    validExtensions.some(ext => 
      urlLower.endsWith(ext) || urlLower.includes(ext + '?')
    )
  );
}

async function convertToPng(imgUrl) {
  try {
    const response = await fetch(imgUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };
      
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      
      img.src = URL.createObjectURL(blob);
    });
  } catch (error) {
    console.error('转换图片格式失败:', error);
    throw error;
  }
}

async function processVisibleImages() {
  try {
    const images = document.querySelectorAll('img');
    const visibleImages = [];
    
    console.log(`找到图片总数: ${images.length}`);
    
    // 收集可见图片
    for (const img of images) {
      if (isElementInViewport(img)) {
        const imageUrl = img.src;
        if (isValidImageUrl(imageUrl)) {
          visibleImages.push(imageUrl);
        }
      }
    }
    
    console.log(`可见区域内找到 ${visibleImages.length} 张有效图片`);
    
    if (visibleImages.length === 0) {
      console.log('未找到可下载的图片');
      return;
    }
    
    // 批量处理所有图片
    console.log('开始处理图片...');
    const processedImages = [];
    
    for (let i = 0; i < visibleImages.length; i++) {
      try {
        const url = visibleImages[i];
        console.log(`处理第 ${i + 1}/${visibleImages.length} 张图片`);
        const blob = await convertToPng(url);
        const base64Data = await blobToBase64(blob);
        processedImages.push({
          data: base64Data,
          filename: `image_${i + 1}.png`
        });
      } catch (error) {
        console.error(`处理第 ${i + 1} 张图片失败:`, error);
      }
    }
    
    // 发送处理后的图片数据到background进行压缩和下载
    chrome.runtime.sendMessage({
      action: "compressAndDownload",
      images: processedImages,
      timestamp: new Date().toISOString().replace(/[:.]/g, '-')
    }, response => {
      if (response && response.success) {
        console.log('图片数据已发送到后台处理');
      } else {
        console.error('发送图片数据失败:', response?.error);
      }
    });
    
  } catch (error) {
    console.error('处理图片过程中出错:', error);
    throw error;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
} 