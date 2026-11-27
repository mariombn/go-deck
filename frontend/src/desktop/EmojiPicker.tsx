import {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {Picker} from 'emoji-mart';
import data from '@emoji-mart/data';
import pt from '@emoji-mart/data/i18n/pt.json';

interface Props {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({onSelect}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  const {i18n} = useTranslation();
  const locale = i18n.language.split('-')[0] === 'pt' ? 'pt' : 'en';

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const picker = new Picker({
      data,
      locale,
      i18n: locale === 'pt' ? pt : undefined,
      set: 'native',
      theme: 'dark',
      autoFocus: true,
      dynamicWidth: true,
      emojiButtonSize: 34,
      onEmojiSelect: ({native}: {native: string}) => select.current(native),
    }) as unknown as HTMLElement;

    picker.style.width = 'min(320px, calc(100vw - 2.5rem))';
    picker.style.height = 'min(420px, calc(100vh - 2.5rem))';
    container.current?.append(picker);
    return () => picker.remove();
  }, [locale]);

  return <div ref={container} />;
}
