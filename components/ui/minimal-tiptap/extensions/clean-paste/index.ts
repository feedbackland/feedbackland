import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const CleanPaste = Extension.create({
  name: "cleanPaste",

  addOptions() {
    return {
      // - \x20-\x7E includes ASCII printable characters, including digits, letters, and punctuation.
      // - \u00A0-\u02AF and \u0370-\u03FF include many Latin, Greek, and other letters, including those with diacritics.
      // - \p{Letter} includes any Unicode letter character from any language.
      // - \s includes whitespace characters.
      // - u flag for Unicode mode.
      regexPattern: /[^\x20-\x7E\u00A0-\u02AF\u0370-\u03FF\p{Letter}\s]/gu,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("cleanPaste"),
        props: {
          handlePaste: (view, event) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            const text = clipboardData.getData("text/plain");
            if (!text) return false;

            const cleanText = text.replace(this.options.regexPattern, "");

            // Stop the default paste
            event.preventDefault();

            // Insert the cleaned text
            const { tr, selection } = view.state;
            const { from, to } = selection;
            const newText = view.state.schema.text(cleanText);
            const transaction = tr.replaceWith(from, to, newText);
            view.dispatch(transaction);

            return true;
          },
        },
      }),
    ];
  },
});
