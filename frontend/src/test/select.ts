import {fireEvent, screen} from '@testing-library/react';

// Exercita o seletor real pelo popup, em vez de forjar change num <select>.
export function selectOptions(control: HTMLElement): HTMLElement[] {
  if (control.getAttribute('aria-expanded') !== 'true') fireEvent.click(control);
  return screen.getAllByRole('option');
}

export function chooseSelect(control: HTMLElement, value: string) {
  const option = selectOptions(control).find((element) => element.getAttribute('data-value') === value);
  if (!option) throw new Error(`Opção não encontrada: ${value}`);
  fireEvent.click(option);
}
