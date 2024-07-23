const { Plugin, MarkdownView, ItemView, WorkspaceLeaf, PluginSettingTab, Setting } = require('obsidian');

const VIEW_TYPE_GOAL_PROGRESS = "goal-progress-view";

const DEFAULT_SETTINGS = {
  includeSpaces: true,
  includePunctuation: true,
  enableGoal: false,
  goalType: 'words',
  goalCount: 1000,
}

class WordCountPlugin extends Plugin {
  settings;
  statusBarItem;

  async onload() {
    await this.loadSettings();

    this.addRibbonIcon('goal', '목표 진행 상황', () => {
      this.activateView();
    });

    this.registerView(
      VIEW_TYPE_GOAL_PROGRESS,
      (leaf) => new GoalProgressView(leaf)
    );

    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('글자 수: 계산 중...');

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updateWordCount();
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', () => {
        this.updateWordCount();
      })
    );

    this.addSettingTab(new WordCountSettingTab(this.app, this));

    this.updateWordCount();
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_GOAL_PROGRESS)[0];
    if (!leaf) {
      leaf = workspace.getLeaf('split', 'vertical');
      await leaf.setViewState({
        type: VIEW_TYPE_GOAL_PROGRESS,
        active: true,
      });
    }

    this.app.workspace.revealLeaf(leaf);
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_GOAL_PROGRESS);
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
    if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
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

      let statusText = `글자 수: ${charCount} | 단어 수: ${wordCount}`;

      if (this.settings.enableGoal) {
        const goalCount = this.settings.goalCount;
        const currentCount = this.settings.goalType === 'words' ? wordCount : charCount;
        const percentage = Math.min(100, Math.round((currentCount / goalCount) * 100));
        statusText += ` | 목표: ${percentage}%`;

        this.updateGoalProgressView(currentCount, goalCount, percentage);
      }

      this.statusBarItem.setText(statusText);
    } else {
      this.statusBarItem.setText('글자 수: N/A');
    }
  }

  updateGoalProgressView(current, goal, percentage) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_GOAL_PROGRESS);
    if (leaves.length > 0) {
      const view = leaves[0].view;
      if (view instanceof GoalProgressView) {
        view.updateProgress(current, goal, percentage);
      }
    }
  }
}

class GoalProgressView extends ItemView {
  constructor(leaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_GOAL_PROGRESS;
  }

  getDisplayText() {
    return "목표 진행 상황";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("h4", { text: "목표 진행 상황" });
    this.progressBarEl = container.createEl("div", { cls: "progress-bar" });
    this.progressTextEl = container.createEl("div", { cls: "progress-text" });
  }

  updateProgress(current, goal, percentage) {
    this.progressBarEl.empty();
    const filledBar = this.progressBarEl.createEl("div", { cls: "progress-filled" });
    filledBar.style.width = `${percentage}%`;
    this.progressTextEl.setText(`${current}/${goal} (${percentage}%)`);
  }
}

class WordCountSettingTab extends PluginSettingTab {
  plugin;

  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const {containerEl} = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('공백 포함')
      .setDesc('글자 수에 공백 포함하기')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeSpaces)
        .onChange(async (value) => {
          this.plugin.settings.includeSpaces = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('문장 부호 포함')
      .setDesc('글자 수에 문장 부호 포함하기')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includePunctuation)
        .onChange(async (value) => {
          this.plugin.settings.includePunctuation = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('목표 기능 활성화')
      .setDesc('글자 수 또는 단어 수 목표 설정 기능 사용')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableGoal)
        .onChange(async (value) => {
          this.plugin.settings.enableGoal = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('목표 유형')
      .setDesc('목표를 글자 수로 설정할지 단어 수로 설정할지 선택')
      .addDropdown(dropdown => dropdown
        .addOption('words', '단어 수')
        .addOption('characters', '글자 수')
        .setValue(this.plugin.settings.goalType)
        .onChange(async (value) => {
          this.plugin.settings.goalType = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('목표 수')
      .setDesc('목표로 하는 글자 수 또는 단어 수 입력')
      .addText(text => text
        .setPlaceholder('1000')
        .setValue(this.plugin.settings.goalCount.toString())
        .onChange(async (value) => {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue) && numValue > 0) {
            this.plugin.settings.goalCount = numValue;
            await this.plugin.saveSettings();
          }
        }));
  }
}

module.exports = WordCountPlugin;
