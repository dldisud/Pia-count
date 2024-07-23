const obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
  includeSpaces: true,
  includePunctuation: true,
}

class WordCountPlugin extends obsidian.Plugin {
  settings;
  statusBarItem;
  activeLeafChange;

  async onload() {
    await this.loadSettings();

    // 상태 바 아이템 추가
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('글자 수: 계산 중...');

    // 활성 파일이 변경될 때마다 글자 수 업데이트
    this.activeLeafChange = this.app.workspace.on('active-leaf-change', () => {
      this.updateWordCount();
    });

    // 편집 이벤트에 대한 리스너 추가
    this.registerEvent(
      this.app.workspace.on('editor-change', () => {
        this.updateWordCount();
      })
    );

    // 설정 탭 추가
    this.addSettingTab(new WordCountSettingTab(this.app, this));

    // 초기 글자 수 업데이트
    this.updateWordCount();
  }

  onunload() {
    // 이벤트 리스너 제거
    this.app.workspace.off('active-leaf-change', this.activeLeafChange);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.updateWordCount();
  }

  updateWordCount() {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf && activeLeaf.view instanceof obsidian.MarkdownView) {
      const editor = activeLeaf.view.editor;
      const text = editor.getValue();

      let processedText = text;
      if (!this.settings.includeSpaces) {
        processedText = processedText.replace(/\s+/g, '');
      }
      if (!this.settings.includePunctuation) {
        processedText = processedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      }

      const charCount = processedText.length;
      const wordCount = text.trim().split(/\s+/).length;

      this.statusBarItem.setText(`글자 수: ${charCount} | 단어 수: ${wordCount}`);
    } else {
      this.statusBarItem.setText('글자 수: N/A');
    }
  }
}

class WordCountSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    let { containerEl } = this;

    containerEl.empty();

    new obsidian.Setting(containerEl)
      .setName('공백 포함')
      .setDesc('글자 수에 공백 포함하기')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeSpaces)
        .onChange(async (value) => {
          this.plugin.settings.includeSpaces = value;
          await this.plugin.saveSettings();
        }));

    new obsidian.Setting(containerEl)
      .setName('문장 부호 포함')
      .setDesc('글자 수에 문장 부호 포함하기')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includePunctuation)
        .onChange(async (value) => {
          this.plugin.settings.includePunctuation = value;
          await this.plugin.saveSettings();
        }));
  }
}

module.exports = WordCountPlugin;