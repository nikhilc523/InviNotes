/**
 * Notion-style slash command menu for TipTap editor.
 */

const BLOCK_ITEMS = [
  { id: 'text',          label: 'Text',           icon: 'T',   iconClass: 'text-icon', shortcut: '',     section: 'Basic blocks' },
  { id: 'heading1',      label: 'Heading 1',      icon: 'H\u2081', iconClass: '',          shortcut: '#',    section: 'Basic blocks' },
  { id: 'heading2',      label: 'Heading 2',      icon: 'H\u2082', iconClass: '',          shortcut: '##',   section: 'Basic blocks' },
  { id: 'heading3',      label: 'Heading 3',      icon: 'H\u2083', iconClass: '',          shortcut: '###',  section: 'Basic blocks' },
  { id: 'heading4',      label: 'Heading 4',      icon: 'H\u2084', iconClass: '',          shortcut: '####', section: 'Basic blocks' },
  { id: 'bulletList',    label: 'Bulleted list',   icon: '\u2022\u2261', iconClass: '',     shortcut: '-',    section: 'Basic blocks' },
  { id: 'orderedList',   label: 'Numbered list',   icon: '1\u2261', iconClass: '',          shortcut: '1.',   section: 'Basic blocks' },
  { id: 'taskList',      label: 'To-do list',      icon: '\u2610', iconClass: '',           shortcut: '[]',   section: 'Basic blocks' },
  { id: 'blockquote',    label: 'Quote',            icon: '\u201C', iconClass: '',           shortcut: '>',    section: 'Basic blocks' },
  { id: 'codeBlock',     label: 'Code',             icon: '</>',   iconClass: '',            shortcut: '```',  section: 'Basic blocks' },
  { id: 'divider',       label: 'Divider',          icon: '\u2014', iconClass: '',           shortcut: '---',  section: 'Basic blocks' },
];

export class SlashMenu {
  constructor(editorGetter) {
    this.getEditor = editorGetter;
    this.menuEl = document.getElementById('slash-menu');
    this.isOpen = false;
    this.selectedIndex = 0;
    this.filteredItems = [...BLOCK_ITEMS];
    this.query = '';
    this.slashPos = null; // position of the `/` character in the doc

    this._onKeyDown = this._onKeyDown.bind(this);
  }

  open(slashPos, coords) {
    this.isOpen = true;
    this.slashPos = slashPos;
    this.query = '';
    this.selectedIndex = 0;
    this.filteredItems = [...BLOCK_ITEMS];

    this._render();
    this._position(coords);
    this.menuEl.classList.add('visible');

    document.addEventListener('keydown', this._onKeyDown, true);
    document.addEventListener('click', this._onClickOutside = (e) => {
      if (!this.menuEl.contains(e.target)) this.close();
    }, true);
  }

  close() {
    this.isOpen = false;
    this.menuEl.classList.remove('visible');
    this.menuEl.innerHTML = '';
    document.removeEventListener('keydown', this._onKeyDown, true);
    if (this._onClickOutside) {
      document.removeEventListener('click', this._onClickOutside, true);
      this._onClickOutside = null;
    }
  }

  updateQuery(query) {
    this.query = query.toLowerCase();
    this.filteredItems = BLOCK_ITEMS.filter(item =>
      item.label.toLowerCase().includes(this.query) ||
      item.id.toLowerCase().includes(this.query) ||
      item.shortcut.includes(this.query)
    );
    this.selectedIndex = 0;
    this._render();
    if (this.filteredItems.length === 0) {
      // No matches — keep open but show empty
    }
  }

  _position(coords) {
    const menuRect = this.menuEl.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    let top = coords.bottom + 4;
    let left = coords.left;

    // Flip up if not enough space below
    if (top + 350 > viewportH) {
      top = coords.top - 350 - 4;
    }
    // Keep within viewport horizontally
    if (left + 324 > viewportW) {
      left = viewportW - 330;
    }

    this.menuEl.style.top = `${Math.max(0, top)}px`;
    this.menuEl.style.left = `${Math.max(0, left)}px`;
  }

  _render() {
    let html = '';
    let currentSection = '';

    for (let i = 0; i < this.filteredItems.length; i++) {
      const item = this.filteredItems[i];
      if (item.section !== currentSection) {
        currentSection = item.section;
        html += `<div class="slash-menu-section">${currentSection}</div>`;
      }
      const selectedClass = i === this.selectedIndex ? ' selected' : '';
      const iconClass = 'slash-icon' + (item.iconClass ? ' ' + item.iconClass : '');
      html += `
        <div class="slash-menu-item${selectedClass}" data-index="${i}">
          <span class="${iconClass}">${item.icon}</span>
          <span class="slash-label">${item.label}</span>
          <span class="slash-shortcut">${item.shortcut}</span>
        </div>`;
    }

    html += `
      <div class="slash-menu-footer" data-action="close">
        <span class="slash-label">Close menu</span>
        <span class="slash-shortcut">esc</span>
      </div>`;

    this.menuEl.innerHTML = html;

    // Bind click handlers
    this.menuEl.querySelectorAll('.slash-menu-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = parseInt(el.dataset.index, 10);
        this._executeItem(this.filteredItems[idx]);
      });
      el.addEventListener('mouseenter', () => {
        this.selectedIndex = parseInt(el.dataset.index, 10);
        this._highlightSelected();
      });
    });

    const footer = this.menuEl.querySelector('.slash-menu-footer');
    if (footer) {
      footer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.close();
        this.getEditor()?.commands.focus();
      });
    }
  }

  _highlightSelected() {
    this.menuEl.querySelectorAll('.slash-menu-item').forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });
    // Scroll selected into view
    const sel = this.menuEl.querySelector('.slash-menu-item.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  _onKeyDown(e) {
    if (!this.isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
        this._highlightSelected();
        break;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
        this._highlightSelected();
        break;

      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (this.filteredItems.length > 0) {
          this._executeItem(this.filteredItems[this.selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.close();
        this.getEditor()?.commands.focus();
        break;
    }
  }

  _executeItem(item) {
    const editor = this.getEditor();
    if (!editor || !item) return;

    // Delete the slash + query text
    const { state } = editor;
    const from = this.slashPos;
    const to = state.selection.from;

    editor.chain().focus()
      .deleteRange({ from, to })
      .run();

    // Apply the block type
    switch (item.id) {
      case 'text':
        editor.chain().focus().setParagraph().run();
        break;
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'heading4':
        editor.chain().focus().toggleHeading({ level: 4 }).run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'taskList':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'divider':
        editor.chain().focus().setHorizontalRule().run();
        break;
    }

    this.close();
  }
}
