// 全局变量
let currentPage = 'main-page';
let soundManager;
let editQuestions = [{'image': '', 'question': '', 'answer': '', 'hint': ''}];
let editIndex = 0;
let editingBank = null;
let gameBank = null;
let gameQuestions = [];
let gameAuthor = '';
let gameIndex = 0;
let correctCount = 0;
let attemptCount = 0;
let gaveUpCount = 0;
let answeredCurrent = false;

// 页面切换函数
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    currentPage = pageId;
}

function showMainPage() {
    showPage('main-page');
}

function showSettingsPage() {
    showPage('settings-page');
}

function showManagePage() {
    showPage('manage-page');
    refreshBankList();
}

function showSelectBankPage() {
    showPage('select-bank-page');
    refreshSelectBankList();
}

function showAddBankPage() {
    showPage('edit-bank-page');
    editQuestions = [{'image': '', 'question': '', 'answer': '', 'hint': ''}];
    editIndex = 0;
    editingBank = null;
    document.getElementById('edit-bank-name').value = '新题库';
    document.getElementById('edit-author').value = '';
    loadEditorQuestion();
}

// 音效管理器
class SoundManager {
    constructor() {
        this.bgmVolume = 0.5;
        this.sfxVolume = 0.5;
        this.sounds = {};
        this.bgm = null;
        this.bgmPlaying = false;
        this.loadSounds();
        this.setupEventListeners();
        this.setupButtonClickSounds();
        this.updateBgmButton();
    }
    
    updateBgmButton() {
        const btn = document.getElementById('bgm-toggle-btn');
        if (btn) {
            btn.innerHTML = this.bgmPlaying ? '🔊' : '🔇';
        }
    }

    loadSounds() {
        // 音效文件路径
        const soundFiles = {
            'win': 'win.wav',
            'lose': 'lose.wav',
            'clear': 'clear.wav',
            'click': 'click.wav'
        };

        // 加载音效
        for (const [name, filename] of Object.entries(soundFiles)) {
            const audio = new Audio(filename);
            audio.volume = this.sfxVolume;
            this.sounds[name] = audio;
        }

        // 加载背景音乐
        this.bgm = new Audio('bgm.mp3');
        this.bgm.volume = this.bgmVolume;
        this.bgm.loop = true;
    }

    playBgm() {
        if (this.bgm) {
            this.bgm.play().catch(e => {
                console.log('背景音乐播放失败:', e);
            });
            this.bgmPlaying = true;
        }
    }

    pauseBgm() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgmPlaying = false;
        }
    }

    toggleBgm() {
        if (this.bgmPlaying) {
            this.pauseBgm();
        } else {
            this.playBgm();
        }
        this.updateBgmButton();
        return this.bgmPlaying;
    }

    setBgmVolume(volume) {
        this.bgmVolume = volume;
        if (this.bgm) {
            this.bgm.volume = volume;
        }
    }

    setSfxVolume(volume) {
        this.sfxVolume = volume;
        for (const audio of Object.values(this.sounds)) {
            audio.volume = volume;
        }
    }

    playSound(name) {
        if (this.sounds[name]) {
            const audio = this.sounds[name].cloneNode();
            audio.volume = this.sfxVolume;
            audio.play().catch(e => {
                console.log(`音效 ${name} 播放失败:`, e);
            });
        }
    }

    setupEventListeners() {
        // 音量控制
        const bgmVolumeSlider = document.getElementById('bgm-volume');
        const sfxVolumeSlider = document.getElementById('sfx-volume');

        bgmVolumeSlider.addEventListener('input', (e) => {
            this.setBgmVolume(parseFloat(e.target.value));
        });

        sfxVolumeSlider.addEventListener('input', (e) => {
            this.setSfxVolume(parseFloat(e.target.value));
        });
    }

    setupButtonClickSounds() {
        // 为所有圆角按钮添加点击音效
        const buttons = document.querySelectorAll('.rounded-button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.playSound('click');
            });
        });
    }
}

// 题库管理类
class QuestionBank {
    static getBanks() {
        const banks = localStorage.getItem('eoe-guess-banks');
        return banks ? JSON.parse(banks) : [];
    }

    static saveBanks(banks) {
        localStorage.setItem('eoe-guess-banks', JSON.stringify(banks));
    }

    static getAllBanks() {
        return this.getBanks();
    }

    static saveBank(name, author, questions) {
        const banks = this.getBanks();
        const bank = {
            id: Date.now(),
            name: name,
            author: author,
            questions: questions,
            count: questions.length
        };
        banks.push(bank);
        this.saveBanks(banks);
        return bank;
    }

    static updateBank(bankId, name, author, questions) {
        const banks = this.getBanks();
        const index = banks.findIndex(b => b.id === bankId);
        if (index !== -1) {
            banks[index] = {
                ...banks[index],
                name: name,
                author: author,
                questions: questions,
                count: questions.length
            };
            this.saveBanks(banks);
            return true;
        }
        return false;
    }

    static deleteBank(bankId) {
        const banks = this.getBanks();
        const newBanks = banks.filter(b => b.id !== bankId);
        this.saveBanks(newBanks);
    }

    static loadBank(bankId) {
        const banks = this.getBanks();
        return banks.find(b => b.id === bankId);
    }

    static importBank(jsonData) {
        try {
            const bankData = JSON.parse(jsonData);
            if (!bankData.name || !bankData.questions) {
                return { success: false, message: '无效的题库格式' };
            }
            
            const banks = this.getBanks();
            
            // 检查是否已存在同名题库，如果存在则替换
            const existingIndex = banks.findIndex(b => b.name === bankData.name);
            
            const bank = {
                id: Date.now(),
                name: bankData.name,
                author: bankData.author || '未知',
                questions: bankData.questions,
                count: bankData.questions.length
            };
            
            if (existingIndex !== -1) {
                // 替换旧题库
                banks[existingIndex] = bank;
            } else {
                // 添加新题库
                banks.push(bank);
            }
            
            this.saveBanks(banks);
            return { success: true, message: '导入成功' };
        } catch (e) {
            return { success: false, message: `导入失败: ${e.message}` };
        }
    }
}

// 刷新题库列表
function refreshBankList() {
    const bankList = document.getElementById('bank-list');
    bankList.innerHTML = '';
    
    const banks = QuestionBank.getAllBanks();
    
    if (banks.length === 0) {
        bankList.innerHTML = '<div class="outlined-text" style="margin: 50px;text-align: center;">暂无题库</div>';
        return;
    }
    
    banks.forEach(bank => {
        const bankItem = createBankItem(bank, true);
        bankList.appendChild(bankItem);
    });
}

// 刷新选择题库列表
function refreshSelectBankList() {
    const bankList = document.getElementById('select-bank-list');
    bankList.innerHTML = '';
    
    const banks = QuestionBank.getAllBanks();
    
    if (banks.length === 0) {
        bankList.innerHTML = '<div class="outlined-text" style="margin: 50px;text-align: center;">暂无题库，请先添加</div>';
        return;
    }
    
    banks.forEach(bank => {
        const bankItem = createBankItem(bank, false);
        bankList.appendChild(bankItem);
    });
}

// 创建题库项
function createBankItem(bank, isManagePage) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'bank-item';
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'bank-item-info';
    infoDiv.innerHTML = `<div class="outlined-text">${bank.name}    作者：${bank.author}    题目：${bank.count}道</div>`;
    
    const btnDiv = document.createElement('div');
    btnDiv.className = 'bank-item-buttons';
    
    if (isManagePage) {
        // 管理页面的按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'rounded-button';
        editBtn.textContent = '编辑';
        editBtn.onclick = () => showEditBankPage(bank);
        
        const exportBtn = document.createElement('button');
        exportBtn.className = 'rounded-button';
        exportBtn.textContent = '导出';
        exportBtn.onclick = () => exportBank(bank);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'rounded-button error';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = () => deleteBank(bank);
        
        btnDiv.appendChild(editBtn);
        btnDiv.appendChild(exportBtn);
        btnDiv.appendChild(deleteBtn);
    } else {
        // 选择页面的按钮
        const selectBtn = document.createElement('button');
        selectBtn.className = 'rounded-button success';
        selectBtn.textContent = '开始';
        selectBtn.onclick = () => startGame(bank);
        
        btnDiv.appendChild(selectBtn);
    }
    
    itemDiv.appendChild(infoDiv);
    itemDiv.appendChild(btnDiv);
    
    return itemDiv;
}

// 编辑题库
function showEditBankPage(bank) {
    showPage('edit-bank-page');
    editingBank = bank;
    editQuestions = JSON.parse(JSON.stringify(bank.questions));
    if (!editQuestions.length) {
        editQuestions = [{'image': '', 'question': '', 'answer': '', 'hint': ''}];
    }
    editIndex = 0;
    document.getElementById('edit-bank-name').value = bank.name;
    document.getElementById('edit-author').value = bank.author;
    loadEditorQuestion();
}

// 加载编辑题
function loadEditorQuestion() {
    if (editIndex >= 0 && editIndex < editQuestions.length) {
        const q = editQuestions[editIndex];
        
        document.getElementById('edit-question').value = q.question || '';
        document.getElementById('edit-answer').value = q.answer || '';
        document.getElementById('edit-hint').value = q.hint || '';
        
        const imgData = q.image;
        const imgButton = document.getElementById('img-button');
        const previewImg = document.getElementById('preview-image');
        
        if (imgData) {
            // 检查是否是URL（以http://或https://开头）
            let imageSrc = '';
            if (imgData.startsWith('http://') || imgData.startsWith('https://')) {
                // 是完整URL，直接使用
                imageSrc = imgData;
            } else if (imgData.includes('\\') || imgData.includes('/')) {
                // 是本地文件路径，构建完整URL
                imageSrc = `banks/${imgData.replace(/\\/g, '/')}`;
            }
            
            // 清除之前的事件监听器
            previewImg.onload = null;
            previewImg.onerror = null;
            
            // 添加图片加载事件处理
            previewImg.onload = () => {
                previewImg.style.display = 'block';
                imgButton.querySelector('span').style.display = 'none';
            };
            
            previewImg.onerror = () => {
                console.error('预览图片加载失败:', imageSrc);
                previewImg.style.display = 'none';
                imgButton.querySelector('span').style.display = 'block';
                // 可以在这里添加加载失败的提示
                alert('图片加载失败，请检查网络连接或图片URL');
            };
            
            // 设置图片源
            previewImg.src = imageSrc;
        } else {
            previewImg.src = '';
            previewImg.style.display = 'none';
            imgButton.querySelector('span').style.display = 'block';
        }
    }
    
    const total = editQuestions.length;
    const valid = editQuestions.filter(q => q.answer).length;
    document.getElementById('question-info').textContent = `第 ${editIndex + 1} / ${total} 题 (有效: ${valid})`;
}

// 保存编辑题
function saveEditorQuestion() {
    if (editIndex >= 0 && editIndex < editQuestions.length) {
        editQuestions[editIndex] = {
            image: editQuestions[editIndex].image || '',
            question: document.getElementById('edit-question').value.trim(),
            answer: document.getElementById('edit-answer').value.trim(),
            hint: document.getElementById('edit-hint').value.trim()
        };
    }
}

// 图片压缩和格式转换函数
async function compressImage(file, options = {}) {
    const {
        maxWidth = 800,
        maxHeight = 600,
        quality = 0.8,
        format = 'webp'
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                // 计算缩放比例
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                // 创建canvas并绘制图片
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 转换为指定格式
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve({
                                blob: blob,
                                url: URL.createObjectURL(blob),
                                width: width,
                                height: height
                            });
                        } else {
                            reject(new Error('图片压缩失败'));
                        }
                    },
                    `image/${format}`,
                    quality
                );
            };
            img.onerror = () => {
                reject(new Error('图片加载失败'));
            };
        };
        reader.onerror = () => {
            reject(new Error('文件读取失败'));
        };
    });
}

// 编辑器上传图片
function editorUploadImage() {
    document.getElementById('file-input').click();
}

// 图片选择事件
document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            // 检查文件大小（限制为5MB）
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                alert('图片大小不能超过5MB，请选择更小的图片');
                return;
            }

            // 图片压缩和格式转换
            const compressedImage = await compressImage(file, {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: 0.8,
                format: 'webp'
            });
            
            // 显示预览
            const previewImg = document.getElementById('preview-image');
            const imgButton = document.getElementById('img-button');
            
            previewImg.onload = () => {
                previewImg.style.display = 'block';
                imgButton.querySelector('span').style.display = 'none';
            };
            
            previewImg.onerror = () => {
                console.error('预览图片加载失败');
                previewImg.style.display = 'none';
                imgButton.querySelector('span').style.display = 'block';
            };
            
            previewImg.src = compressedImage.url;
            
            // 保存压缩后的图片数据
            editQuestions[editIndex].image = compressedImage.url;
            editQuestions[editIndex].imageWidth = compressedImage.width;
            editQuestions[editIndex].imageHeight = compressedImage.height;
        } catch (error) {
            console.error('图片处理失败:', error);
            alert('图片上传失败');
        }
    }
});

// 编辑按钮事件
function editorPrev() {
    if (editIndex > 0) {
        saveEditorQuestion();
        editIndex--;
        loadEditorQuestion();
    }
}

function editorNext() {
    if (editIndex < editQuestions.length - 1) {
        saveEditorQuestion();
        editIndex++;
        loadEditorQuestion();
    }
}

function editorAdd() {
    saveEditorQuestion();
    editQuestions.push({'image': '', 'question': '', 'answer': '', 'hint': ''});
    editIndex = editQuestions.length - 1;
    loadEditorQuestion();
}

function editorClear() {
    editQuestions[editIndex] = {'image': '', 'question': '', 'answer': '', 'hint': ''};
    loadEditorQuestion();
}

function editorSave() {
    saveEditorQuestion();
    const validQuestions = editQuestions.filter(q => q.answer);
    
    if (validQuestions.length === 0) {
        alert('请至少添加一道有效题目（必须有答案）！');
        return;
    }
    
    const bankName = document.getElementById('edit-bank-name').value.trim() || '新题库';
    const author = document.getElementById('edit-author').value.trim() || '未知';
    
    if (editingBank) {
        QuestionBank.updateBank(editingBank.id, bankName, author, validQuestions);
    } else {
        QuestionBank.saveBank(bankName, author, validQuestions);
    }
    
    alert('保存成功！');
    showManagePage();
}

// 导入题库
function importBank() {
    document.getElementById('bank-import-input').click();
}

// 题库导入事件
document.getElementById('bank-import-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = QuestionBank.importBank(event.target.result);
            if (result.success) {
                alert('导入成功！');
                refreshBankList();
            } else {
                alert(result.message);
            }
        };
        reader.readAsText(file);
    }
});

// 导出题库
function exportBank(bank) {
    const dataStr = JSON.stringify(bank, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${bank.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// 删除题库
function deleteBank(bank) {
    if (confirm(`确定删除题库 '${bank.name}' 吗？`)) {
        QuestionBank.deleteBank(bank.id);
        refreshBankList();
    }
}

// 图片预加载核心函数
async function preloadImages(questions) {
    return new Promise((resolve) => {
        // 显示加载进度条
        const loadingOverlay = document.getElementById('loading-overlay');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        loadingOverlay.style.display = 'flex';
        
        // 获取所有需要加载的图片URL
        const imagesToLoad = [];
        questions.forEach(question => {
            if (question.image) {
                let imageSrc = '';
                if (question.image.startsWith('http://') || question.image.startsWith('https://')) {
                    // 是完整URL，直接使用
                    imageSrc = question.image;
                } else if (question.image.includes('\\') || question.image.includes('/')) {
                    // 是本地文件路径，构建完整URL
                    imageSrc = `banks/${question.image.replace(/\\/g, '/')}`;
                }
                if (imageSrc) {
                    imagesToLoad.push(imageSrc);
                }
            }
        });
        
        const totalImages = imagesToLoad.length;
        if (totalImages === 0) {
            // 没有图片需要加载，直接完成
            loadingOverlay.style.display = 'none';
            resolve();
            return;
        }
        
        let loadedImages = 0;
        
        // 更新进度的函数
        const updateProgress = () => {
            const progress = Math.floor((loadedImages / totalImages) * 100);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
        };
        
        // 使用懒加载管理器预加载图片
        const loadAllImages = async () => {
            for (const imageSrc of imagesToLoad) {
                try {
                    await imageLoader.loadImageWithRetry(imageSrc);
                } catch (error) {
                    console.warn('图片预加载失败:', error);
                } finally {
                    loadedImages++;
                    updateProgress();
                }
            }
            
            // 加载完成后延迟0.5秒隐藏加载框，让用户感知到加载完成
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                resolve();
            }, 500);
        };
        
        loadAllImages();
    });
}

// 开始游戏
async function startGame(bank) {
    gameBank = bank;
    gameQuestions = JSON.parse(JSON.stringify(bank.questions));
    gameAuthor = bank.author || '未知';
    gameIndex = 0;
    correctCount = 0;
    attemptCount = 0;
    gaveUpCount = 0;
    answeredCurrent = false;
    
    // 预加载图片
    await preloadImages(gameQuestions);
    
    // 预加载完成后显示游戏页面
    showGamePage();
}

// 网络状态管理器
class NetworkManager {
    constructor() {
        this.currentNetworkType = 'unknown';
        this.isOnline = navigator.onLine;
        this.networkQuality = 'good';
        this.initNetworkListeners();
    }

    // 初始化网络监听器
    initNetworkListeners() {
        // 监听在线/离线状态变化
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('网络已连接');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('网络已断开');
            alert('网络连接已断开，请检查网络设置');
        });

        // 监听网络类型变化
        if ('connection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            
            const updateNetworkInfo = () => {
                this.currentNetworkType = connection.effectiveType || 'unknown';
                this.networkQuality = this.getNetworkQuality(connection);
                console.log(`网络类型: ${this.currentNetworkType}, 质量: ${this.networkQuality}`);
            };

            updateNetworkInfo();
            connection.addEventListener('change', updateNetworkInfo);
        }
    }

    // 根据网络连接获取网络质量
    getNetworkQuality(connection) {
        const downlink = connection.downlink || 10;
        const rtt = connection.rtt || 50;
        
        if (downlink < 1 || rtt > 500) {
            return 'poor';
        } else if (downlink < 3 || rtt > 200) {
            return 'medium';
        } else {
            return 'good';
        }
    }

    // 获取当前网络质量
    getCurrentQuality() {
        return this.networkQuality;
    }

    // 获取当前网络类型
    getCurrentType() {
        return this.currentNetworkType;
    }

    // 检查是否在线
    isOnline() {
        return this.isOnline;
    }

    // 根据网络质量获取图片加载配置
    getImageLoadConfig() {
        const configs = {
            good: {
                quality: 0.8,
                timeout: 10000,
                maxRetries: 3
            },
            medium: {
                quality: 0.6,
                timeout: 15000,
                maxRetries: 2
            },
            poor: {
                quality: 0.4,
                timeout: 20000,
                maxRetries: 1
            }
        };
        return configs[this.networkQuality] || configs.good;
    }
}

// 图片懒加载管理器
class ImageLazyLoader {
    constructor(networkManager) {
        this.loadedImages = new Set();
        this.imageCache = new Map();
        this.networkManager = networkManager;
    }

    // 加载图片并处理失败重试
    loadImageWithRetry(imageSrc, maxRetries = null, retryDelay = 1000) {
        // 获取网络质量相关配置
        const networkConfig = this.networkManager.getImageLoadConfig();
        maxRetries = maxRetries !== null ? maxRetries : networkConfig.maxRetries;
        const timeout = networkConfig.timeout;

        return new Promise((resolve, reject) => {
            let retries = 0;
            let timeoutId;

            const loadImage = () => {
                // 检查缓存
                if (this.imageCache.has(imageSrc)) {
                    resolve(this.imageCache.get(imageSrc));
                    return;
                }

                // 检查网络状态
                if (!this.networkManager.isOnline) {
                    reject(new Error('网络连接已断开'));
                    return;
                }

                const img = new Image();
                
                img.onload = () => {
                    clearTimeout(timeoutId);
                    this.loadedImages.add(imageSrc);
                    this.imageCache.set(imageSrc, img);
                    resolve(img);
                };
                
                img.onerror = () => {
                    clearTimeout(timeoutId);
                    retries++;
                    if (retries <= maxRetries) {
                        console.log(`图片加载失败，正在重试 (${retries}/${maxRetries}):`, imageSrc);
                        setTimeout(loadImage, retryDelay);
                    } else {
                        console.error(`图片加载多次失败:`, imageSrc);
                        reject(new Error(`图片加载失败: ${imageSrc}`));
                    }
                };
                
                // 设置超时
                timeoutId = setTimeout(() => {
                    img.onerror(new Error(`图片加载超时 (${timeout}ms): ${imageSrc}`));
                }, timeout);
                
                img.src = imageSrc;
            };
            
            loadImage();
        });
    }

    // 预加载图片（用于游戏开始前）
    async preloadImages(imageUrls) {
        const promises = imageUrls.map(url => 
            this.loadImageWithRetry(url).catch(err => {
                console.error(`预加载图片失败:`, err);
                return null;
            })
        );
        return Promise.all(promises);
    }

    // 检查图片是否已加载
    isLoaded(imageSrc) {
        return this.loadedImages.has(imageSrc);
    }
}

// 初始化网络管理器和图片懒加载管理器
let networkManager;
let imageLoader;

// 显示游戏页面
function showGamePage() {
    showPage('game-page');
    
    const currentQ = gameQuestions[gameIndex];
    
    // 更新游戏信息
    document.getElementById('game-author').textContent = `作者：${gameAuthor}`;
    document.getElementById('game-progress').textContent = `第 ${gameIndex + 1} / ${gameQuestions.length} 题`;
    
    // 设置问题和图片
    document.getElementById('game-question').textContent = currentQ.question || '猜猜这是什么？';
    document.getElementById('game-answer-input').value = '';
    document.getElementById('result-text').textContent = '';
    document.getElementById('next-btn-container').style.display = 'none';
    
    const gameImage = document.getElementById('game-image');
    if (currentQ.image) {
        // 检查是否是URL（以http://或https://开头）
        let imageSrc = '';
        if (currentQ.image.startsWith('http://') || currentQ.image.startsWith('https://')) {
            // 是完整URL，直接使用
            imageSrc = currentQ.image;
        } else if (currentQ.image.includes('\\') || currentQ.image.includes('/')) {
            // 是本地文件路径，构建完整URL
            imageSrc = `banks/${currentQ.image.replace(/\\/g, '/')}`;
        }
        
        // 先将图片隐藏
        gameImage.style.display = 'none';
        
        // 清除之前的事件监听器
        gameImage.onload = null;
        gameImage.onerror = null;
        
        // 使用懒加载管理器加载图片
        imageLoader.loadImageWithRetry(imageSrc)
            .then(() => {
                // 图片加载成功，设置到游戏图片元素
                gameImage.onload = () => {
                    gameImage.style.display = 'block';
                };
                
                gameImage.onerror = () => {
                    console.error('游戏图片加载失败:', imageSrc);
                    gameImage.style.display = 'none';
                    document.getElementById('result-text').textContent = '图片加载失败，请检查网络连接或图片URL';
                };
                
                gameImage.src = imageSrc;
            })
            .catch(error => {
                console.error('使用懒加载加载图片失败:', error);
                gameImage.style.display = 'none';
                document.getElementById('result-text').textContent = '图片加载失败，请检查网络连接或图片URL';
            });
    } else {
        gameImage.src = '';
        gameImage.style.display = 'none';
    }
    
    answeredCurrent = false;
}

// 检查答案
function checkAnswer() {
    if (answeredCurrent) return;
    
    const userAnswer = document.getElementById('game-answer-input').value.trim();
    const correctAnswer = gameQuestions[gameIndex].answer;
    attemptCount++;
    
    if (userAnswer === correctAnswer) {
        correctCount++;
        answeredCurrent = true;
        soundManager.playSound('win');
        document.getElementById('result-text').textContent = '答对啦！太棒了！';
        document.getElementById('next-btn-container').style.display = 'block';
    } else {
        soundManager.playSound('lose');
        document.getElementById('result-text').textContent = '答错啦~';
    }
}

// 显示提示
function showHint() {
    const hint = gameQuestions[gameIndex].hint;
    document.getElementById('result-text').textContent = hint ? `提示: ${hint}` : '这道题没有提示哦~';
}

// 放弃
function giveUp() {
    if (answeredCurrent) return;
    
    gaveUpCount++;
    answeredCurrent = true;
    const correctAnswer = gameQuestions[gameIndex].answer;
    document.getElementById('result-text').textContent = `正确答案是: ${correctAnswer}`;
    document.getElementById('next-btn-container').style.display = 'block';
}

// 下一题
function nextQuestion() {
    gameIndex++;
    if (gameIndex >= gameQuestions.length) {
        showGameComplete();
    } else {
        showGamePage();
    }
}

// 显示游戏完成
function showGameComplete() {
    showPage('complete-page');
    soundManager.playSound('clear');
    
    const total = attemptCount + gaveUpCount;
    const accuracy = total > 0 ? (correctCount / total * 100).toFixed(1) : 0;
    
    document.getElementById('stats-correct').textContent = `答对: ${correctCount}`;
    document.getElementById('stats-wrong').textContent = `答错/放弃: ${total - correctCount}`;
    document.getElementById('stats-accuracy').textContent = `正确率: ${accuracy}%`;
}

// 全局函数 - 切换背景音乐
function toggleBgm() {
    const isPlaying = soundManager.toggleBgm();
    const btn = document.getElementById('bgm-toggle');
    btn.textContent = isPlaying ? '关闭音乐' : '开启音乐';
}

// 新增：加载初始题库（从banks文件夹导入）
async function loadInitialBanks() {
    // 定义初始题库文件路径
    const initialBankFiles = [
        'banks/第一期_updated.json',
        'banks/第二期_updated.json'
    ];

    // 遍历并导入每个初始题库
    for (const filePath of initialBankFiles) {
        try {
            // 请求JSON文件
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`加载 ${filePath} 失败: ${response.status}`);
            }
            const bankData = await response.json();

            // 导入题库（importBank会自动处理同名替换）
            const importResult = QuestionBank.importBank(JSON.stringify(bankData));
            if (importResult.success) {
                console.log(`初始题库 "${bankData.name}" 导入成功`);
            } else {
                console.error(`导入 ${filePath} 失败: ${importResult.message}`);
            }
        } catch (error) {
            console.error(`处理 ${filePath} 时出错:`, error);
        }
    }
}

// 修改初始化逻辑：在DOM加载完成后调用loadInitialBanks
window.addEventListener('DOMContentLoaded', () => {
    // 初始化音效管理器
    soundManager = new SoundManager();
    
    // 初始化网络管理器
    networkManager = new NetworkManager();
    
    // 初始化图片懒加载管理器
    imageLoader = new ImageLazyLoader(networkManager);
    
    // 加载初始题库（关键新增）
    loadInitialBanks().then(() => {
        // 初始题库加载完成后，初始化页面
        showMainPage();
    });
});

// 响应式缩放
window.addEventListener('resize', () => {
    // 可以在这里添加响应式调整逻辑
});