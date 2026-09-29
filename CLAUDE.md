@AGENTS.md

## Language rule (bắt buộc)

- **Chat with the user in Vietnamese** (giải thích, trả lời, báo cáo tiến độ: tiếng Việt).
- **All code must be in English**: identifiers (variables, functions, types, components),
  file and folder names, API route paths, JSON keys, code comments, and AI system prompts.
- **Exception — end-user text stays Vietnamese**: UI labels, messages shown to players,
  and error messages returned to the UI are Vietnamese with full diacritics,
  because the product's users are Vietnamese.
- Exception — on-chain data format stays as is: the SCAMREG memo key `loai=` and
  values such as `khong-xac-dinh` / `tranh_chap` must not be renamed, or existing
  on-chain records stop matching.
