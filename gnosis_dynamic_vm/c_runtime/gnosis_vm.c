#include "gnosis_vm.h"

#include <string.h>

static uint16_t read_u16(const uint8_t *p) {
  return (uint16_t)(((uint16_t)p[0] << 8) | (uint16_t)p[1]);
}

static uint32_t read_u32(const uint8_t *p) {
  return ((uint32_t)p[0] << 24) |
         ((uint32_t)p[1] << 16) |
         ((uint32_t)p[2] << 8) |
         (uint32_t)p[3];
}

static uint16_t clamp_u16(int32_t value) {
  if (value < 0) {
    return 0;
  }
  if (value > 65535) {
    return 65535;
  }
  return (uint16_t)value;
}

static bool read_indexed_string(const uint8_t *section,
                                uint16_t count,
                                uint16_t index,
                                GnosisStringView *out_string) {
  uint16_t i;
  const uint8_t *cursor = section;
  if (index >= count || out_string == NULL) {
    return false;
  }
  for (i = 0; i < index; ++i) {
    uint16_t len = read_u16(cursor);
    cursor += 2u + len;
  }
  out_string->len = read_u16(cursor);
  cursor += 2;
  out_string->data = (const char *)cursor;
  return true;
}

bool gnosis_load_program(const uint8_t *blob, uint32_t blob_size, GnosisProgram *out_program) {
  uint16_t bind_i;
  uint16_t string_i;
  const uint8_t *cursor;

  if (blob == NULL || out_program == NULL || blob_size < 17u) {
    return false;
  }
  if (blob[0] != GNOSIS_MAGIC_0 || blob[1] != GNOSIS_MAGIC_1 ||
      blob[2] != GNOSIS_MAGIC_2 || blob[3] != GNOSIS_MAGIC_3) {
    return false;
  }
  if (blob[4] != GNOSIS_VERSION) {
    return false;
  }

  memset(out_program, 0, sizeof(*out_program));
  out_program->blob = blob;
  out_program->blob_size = blob_size;
  out_program->node_count = read_u16(blob + 5);
  out_program->slot_count = read_u16(blob + 7);
  out_program->bind_count = read_u16(blob + 9);
  out_program->string_count = read_u16(blob + 11);
  out_program->code_len = read_u32(blob + 13);

  cursor = blob + 17;
  out_program->bind_section = cursor;
  for (bind_i = 0; bind_i < out_program->bind_count; ++bind_i) {
    uint16_t len;
    if ((uint32_t)(cursor - blob + 2u) > blob_size) {
      return false;
    }
    len = read_u16(cursor);
    cursor += 2u + len;
    if ((uint32_t)(cursor - blob) > blob_size) {
      return false;
    }
  }
  out_program->string_section = cursor;
  for (string_i = 0; string_i < out_program->string_count; ++string_i) {
    uint16_t len;
    if ((uint32_t)(cursor - blob + 2u) > blob_size) {
      return false;
    }
    len = read_u16(cursor);
    cursor += 2u + len;
    if ((uint32_t)(cursor - blob) > blob_size) {
      return false;
    }
  }
  out_program->slot_init_section = cursor;
  cursor += (uint32_t)out_program->slot_count * 2u;
  if ((uint32_t)(cursor - blob + out_program->code_len) > blob_size) {
    return false;
  }
  out_program->code_section = cursor;
  return true;
}

bool gnosis_read_bind(const GnosisProgram *program, uint16_t index, GnosisStringView *out_string) {
  if (program == NULL) {
    return false;
  }
  return read_indexed_string(program->bind_section, program->bind_count, index, out_string);
}

bool gnosis_read_string(const GnosisProgram *program, uint16_t index, GnosisStringView *out_string) {
  if (program == NULL) {
    return false;
  }
  return read_indexed_string(program->string_section, program->string_count, index, out_string);
}

bool gnosis_eval(const GnosisProgram *program,
                 const GnosisHooks *hooks,
                 void *ctx,
                 uint16_t *slot_buffer,
                 uint16_t slot_capacity) {
  uint16_t i;
  const uint8_t *pc;
  const uint8_t *code_end;
  int32_t stack[GNOSIS_STACK_MAX];
  uint8_t sp = 0;

  if (program == NULL || hooks == NULL || slot_buffer == NULL) {
    return false;
  }
  if (slot_capacity < program->slot_count) {
    return false;
  }

  for (i = 0; i < program->slot_count; ++i) {
    slot_buffer[i] = read_u16(program->slot_init_section + (uint32_t)i * 2u);
  }

  pc = program->code_section;
  code_end = program->code_section + program->code_len;

  while (pc < code_end) {
    uint8_t op = *pc++;
    switch (op) {
      case GNOSIS_OP_MEASURE_TEXT_BIND: {
        uint16_t node_id = read_u16(pc); pc += 2;
        uint16_t bind_id = read_u16(pc); pc += 2;
        uint8_t size = *pc++;
        GnosisStringView text = {0};
        if (hooks->resolve_text == NULL) {
          return false;
        }
        text = hooks->resolve_text(ctx, bind_id);
        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_MW)] =
            clamp_u16((int32_t)text.len * (int32_t)GNOSIS_GLYPH_W * (int32_t)size);
        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_MH)] =
            clamp_u16((int32_t)GNOSIS_GLYPH_H * (int32_t)size);
      } break;

      case GNOSIS_OP_PUSH_CONST: {
        if (sp >= GNOSIS_STACK_MAX) return false;
        stack[sp++] = (int32_t)read_u16(pc); pc += 2;
      } break;

      case GNOSIS_OP_PUSH_SLOT: {
        uint16_t slot_id = read_u16(pc); pc += 2;
        if (slot_id >= program->slot_count || sp >= GNOSIS_STACK_MAX) {
          return false;
        }
        stack[sp++] = slot_buffer[slot_id];
      } break;

      case GNOSIS_OP_ADD:
      case GNOSIS_OP_SUB:
      case GNOSIS_OP_MUL:
      case GNOSIS_OP_DIV:
      case GNOSIS_OP_MAX:
      case GNOSIS_OP_MIN: {
        int32_t lhs;
        int32_t rhs;
        if (sp < 2) {
          return false;
        }
        rhs = stack[--sp];
        lhs = stack[--sp];
        switch (op) {
          case GNOSIS_OP_ADD: stack[sp++] = lhs + rhs; break;
          case GNOSIS_OP_SUB: stack[sp++] = lhs - rhs; break;
          case GNOSIS_OP_MUL: stack[sp++] = lhs * rhs; break;
          case GNOSIS_OP_DIV: stack[sp++] = (rhs == 0) ? 0 : (lhs / rhs); break;
          case GNOSIS_OP_MAX: stack[sp++] = (lhs > rhs) ? lhs : rhs; break;
          case GNOSIS_OP_MIN: stack[sp++] = (lhs < rhs) ? lhs : rhs; break;
          default: return false;
        }
      } break;

      case GNOSIS_OP_STORE_SLOT: {
        uint16_t slot_id = read_u16(pc); pc += 2;
        if (slot_id >= program->slot_count || sp < 1) {
          return false;
        }
        slot_buffer[slot_id] = clamp_u16(stack[--sp]);
      } break;

      case GNOSIS_OP_DRAW_TEXT_CONST: {
        uint16_t node_id = read_u16(pc); pc += 2;
        uint16_t string_id = read_u16(pc); pc += 2;
        uint8_t size = *pc++;
        uint8_t color = *pc++;
        GnosisStringView text = {0};
        if (hooks->draw_text == NULL || !gnosis_read_string(program, string_id, &text)) {
          return false;
        }
        hooks->draw_text(ctx,
                         slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_X)],
                         slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_Y)],
                         slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_W)],
                         slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_H)],
                         text,
                         size,
                         color);
      } break;

      case GNOSIS_OP_DRAW_TEXT_BIND: {
        uint16_t node_id = read_u16(pc); pc += 2;
        uint16_t bind_id = read_u16(pc); pc += 2;
        uint8_t size = *pc++;
        uint8_t color = *pc++;
        GnosisStringView text = {0};
        if (hooks->resolve_text == NULL || hooks->draw_text == NULL) {
          return false;
        }
        text = hooks->resolve_text(ctx, bind_id);
        hooks->draw_text(ctx,
                         slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_X)],
                         slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_Y)],
                         slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_W)],
                         slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_H)],
                         text,
                         size,
                         color);
      } break;

      case GNOSIS_OP_DRAW_BAR_BIND: {
        uint16_t node_id = read_u16(pc); pc += 2;
        uint16_t bind_id = read_u16(pc); pc += 2;
        uint16_t max_value = read_u16(pc); pc += 2;
        uint8_t track = *pc++;
        uint8_t fill = *pc++;
        int32_t value = 0;
        if (hooks->resolve_i32 == NULL || hooks->draw_bar == NULL) {
          return false;
        }
        value = hooks->resolve_i32(ctx, bind_id);
        hooks->draw_bar(ctx,
                        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_X)],
                        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_Y)],
                        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_W)],
                        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_H)],
                        value,
                        (int32_t)max_value,
                        track,
                        fill);
      } break;

      case GNOSIS_OP_DRAW_BAR_CONST: {
        uint16_t node_id = read_u16(pc); pc += 2;
        uint16_t value = read_u16(pc); pc += 2;
        uint16_t max_value = read_u16(pc); pc += 2;
        uint8_t track = *pc++;
        uint8_t fill = *pc++;
        if (hooks->draw_bar == NULL) {
          return false;
        }
        hooks->draw_bar(ctx,
                        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_X)],
                        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_Y)],
                        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_W)],
                        slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_H)],
                        (int32_t)value,
                        (int32_t)max_value,
                        track,
                        fill);
      } break;

      case GNOSIS_OP_DRAW_HLINE: {
        uint16_t node_id = read_u16(pc); pc += 2;
        uint8_t color = *pc++;
        if (hooks->draw_hline == NULL) {
          return false;
        }
        hooks->draw_hline(ctx,
                          slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_X)],
                          slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_Y)],
                          slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_W)],
                          color);
      } break;

      case GNOSIS_OP_DRAW_VLINE: {
        uint16_t node_id = read_u16(pc); pc += 2;
        uint8_t color = *pc++;
        if (hooks->draw_vline == NULL) {
          return false;
        }
        hooks->draw_vline(ctx,
                          slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_X)],
                          slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_Y)],
                          slot_buffer[gnosis_slot_id(node_id, GNOSIS_SLOT_H)],
                          color);
      } break;

      case GNOSIS_OP_HALT:
        return true;

      default:
        return false;
    }
  }

  return false;
}
