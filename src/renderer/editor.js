import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { yCursorPlugin } from '@tiptap/y-tiptap';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

// Custom cursor extension using @tiptap/y-tiptap's yCursorPlugin
const CollabCursors = Extension.create({
  name: 'collabCursors',

  addOptions() {
    return {
      provider: null,
      user: { name: 'Anonymous', color: '#2383e2' },
    };
  },

  addProseMirrorPlugins() {
    const { provider, user } = this.options;
    if (!provider) return [];

    provider.awareness.setLocalStateField('user', user);

    return [
      yCursorPlugin(provider.awareness, {
        cursorBuilder: (u) => {
          const cursor = document.createElement('span');
          cursor.classList.add('collaboration-cursor__caret');
          cursor.setAttribute('style', `border-color: ${u.color}`);

          const label = document.createElement('div');
          label.classList.add('collaboration-cursor__label');
          label.setAttribute('style', `background-color: ${u.color}`);
          label.appendChild(document.createTextNode(u.name));
          cursor.appendChild(label);

          return cursor;
        },
      }),
    ];
  },
});

// Shared extensions
function getBaseExtensions() {
  return [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'javascript' }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: ({ node, editor }) => {
        if (node.type.name === 'heading') {
          return 'Heading ' + node.attrs.level;
        }
        // First node in empty doc — big "New page" style placeholder
        const { doc } = editor.state;
        if (doc.firstChild === node && doc.childCount === 1) {
          return 'Type \'/\' for commands...';
        }
        return 'Type \'/\' for commands...';
      },
    }),
  ];
}

/**
 * Create a standalone editor (no collaboration)
 */
export function createEditor(element) {
  return new Editor({
    element,
    extensions: getBaseExtensions(),
    content: '',
    editorProps: {
      attributes: { class: 'invinotes-editor', spellcheck: 'false' },
    },
  });
}

/**
 * Create a collaborative editor bound to a Yjs document.
 */
export function createCollabEditor(element, ydocFragment, provider, user) {
  const extensions = getBaseExtensions();
  // Remove history from StarterKit for collab
  extensions[0] = StarterKit.configure({
    codeBlock: false,
    history: false,
  });
  extensions.push(
    Collaboration.configure({ fragment: ydocFragment }),
    CollabCursors.configure({
      provider,
      user: { name: user.name, color: user.color },
    })
  );

  return new Editor({
    element,
    extensions,
    editorProps: {
      attributes: { class: 'invinotes-editor', spellcheck: 'false' },
    },
  });
}
