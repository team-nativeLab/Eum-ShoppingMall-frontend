'use client';

import { ChevronDown, CircleAlert, CircleCheck } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

/** 입력·선택 필드가 함께 쓰는 라벨·도움말 속성 */
interface FieldMetaProps {
  label: string;
  /** 라벨을 화면에서 숨기고 스크린리더에만 읽힐 때 */
  isLabelHidden?: boolean;
  helperText?: string;
  /** 값이 있으면 오류 상태(Figma State=Error)로 보여 줍니다 */
  errorMessage?: string;
  /** 값이 있으면 확인 완료 상태(Figma State=Success)로 보여 줍니다 */
  successMessage?: string;
}

// Figma Field: h48 · px14 · r8 · 기본 1px line-strong, 포커스·오류는 1.5px(안쪽 0.5px 링을 더함)
const FIELD_BASE_CLASS =
  'h-48 w-full rounded-8 border bg-bg px-14 text-body-m text-text-1 outline-none transition-colors placeholder:text-text-3 disabled:cursor-not-allowed disabled:border-surface disabled:bg-surface disabled:text-text-disabled';

// 상태에 맞는 테두리 className을 고르는 함수
function getFieldStateClass(hasError: boolean): string {
  return hasError
    ? 'border-danger ring-[0.5px] ring-inset ring-danger'
    : 'border-line-strong focus:border-text-1 focus:ring-[0.5px] focus:ring-inset focus:ring-text-1';
}

interface FieldShellProps extends FieldMetaProps {
  fieldId: string;
  helperId: string;
  className?: string;
  children: ReactNode;
}

// 라벨 + 필드 + 도움말 줄을 감싸는 공통 틀
function FieldShell({
  fieldId,
  helperId,
  label,
  isLabelHidden = false,
  helperText,
  errorMessage,
  successMessage,
  className,
  children,
}: FieldShellProps) {
  const helperMessage = errorMessage ?? successMessage ?? helperText;
  return (
    <div className={cx('flex w-full flex-col gap-8', className)}>
      <label
        htmlFor={fieldId}
        className={cx('text-label-m text-text-1', isLabelHidden && 'sr-only')}
      >
        {label}
      </label>
      {children}
      {helperMessage ? (
        <p
          id={helperId}
          className={cx(
            'flex items-center gap-4 text-caption',
            errorMessage ? 'text-danger' : successMessage ? 'text-success' : 'text-text-3',
          )}
        >
          {errorMessage ? <Icon icon={CircleAlert} size={14} /> : null}
          {!errorMessage && successMessage ? <Icon icon={CircleCheck} size={14} /> : null}
          {helperMessage}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps
  extends FieldMetaProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  /** 바깥 래퍼 className */
  className?: string;
  /** input 자체 className */
  inputClassName?: string;
}

/** 텍스트 입력(Figma HF/TextField Type=Input). 라벨·도움말·오류를 input과 연결합니다. */
export function TextField({
  label,
  isLabelHidden,
  helperText,
  errorMessage,
  successMessage,
  className,
  inputClassName,
  id,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = `${fieldId}-helper`;
  const hasHelper = Boolean(errorMessage ?? successMessage ?? helperText);
  return (
    <FieldShell
      fieldId={fieldId}
      helperId={helperId}
      label={label}
      isLabelHidden={isLabelHidden}
      helperText={helperText}
      errorMessage={errorMessage}
      successMessage={successMessage}
      className={className}
    >
      <input
        id={fieldId}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={hasHelper ? helperId : undefined}
        className={cx(FIELD_BASE_CLASS, getFieldStateClass(Boolean(errorMessage)), inputClassName)}
        {...inputProps}
      />
    </FieldShell>
  );
}

export interface SelectFieldOption {
  value: string;
  label: string;
}

export interface SelectFieldProps
  extends FieldMetaProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectFieldOption[];
  /** 아무것도 고르지 않았을 때 보이는 안내(빈 값 option) */
  placeholder?: string;
  className?: string;
}

/** 선택 입력(Figma HF/TextField Type=Select). 네이티브 select라 키보드·스크린리더를 그대로 지원합니다. */
export function SelectField({
  label,
  isLabelHidden,
  helperText,
  errorMessage,
  successMessage,
  options,
  placeholder,
  className,
  id,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = `${fieldId}-helper`;
  const hasHelper = Boolean(errorMessage ?? successMessage ?? helperText);
  return (
    <FieldShell
      fieldId={fieldId}
      helperId={helperId}
      label={label}
      isLabelHidden={isLabelHidden}
      helperText={helperText}
      errorMessage={errorMessage}
      successMessage={successMessage}
      className={className}
    >
      <div className="relative w-full">
        <select
          id={fieldId}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={hasHelper ? helperId : undefined}
          className={cx(
            FIELD_BASE_CLASS,
            getFieldStateClass(Boolean(errorMessage)),
            'appearance-none pr-40',
          )}
          {...selectProps}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          icon={ChevronDown}
          size={20}
          className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
        />
      </div>
    </FieldShell>
  );
}
