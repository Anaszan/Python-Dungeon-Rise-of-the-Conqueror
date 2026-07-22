// At least 8 characters, at least one uppercase letter, at least one
// special (non-alphanumeric) character.
export const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/

export const PASSWORD_HINT = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร มีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว และมีอักขระพิเศษอย่างน้อย 1 ตัว'
