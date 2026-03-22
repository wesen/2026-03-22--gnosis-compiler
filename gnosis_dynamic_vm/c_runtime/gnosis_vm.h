#ifndef GNOSIS_VM_H
#define GNOSIS_VM_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define GNOSIS_MAGIC_0 'G'
#define GNOSIS_MAGIC_1 'N'
#define GNOSIS_MAGIC_2 'D'
#define GNOSIS_MAGIC_3 'Y'
#define GNOSIS_VERSION 1
#define GNOSIS_FIELDS_PER_NODE 6
#define GNOSIS_GLYPH_W 8
#define GNOSIS_GLYPH_H 8
#define GNOSIS_STACK_MAX 64

enum GnosisField {
  GNOSIS_SLOT_MW = 0,
  GNOSIS_SLOT_MH = 1,
  GNOSIS_SLOT_X = 2,
  GNOSIS_SLOT_Y = 3,
  GNOSIS_SLOT_W = 4,
  GNOSIS_SLOT_H = 5,
};

enum GnosisOp {
  GNOSIS_OP_MEASURE_TEXT_BIND = 0x01,
  GNOSIS_OP_PUSH_CONST = 0x02,
  GNOSIS_OP_PUSH_SLOT = 0x03,
  GNOSIS_OP_ADD = 0x04,
  GNOSIS_OP_SUB = 0x05,
  GNOSIS_OP_MUL = 0x06,
  GNOSIS_OP_DIV = 0x07,
  GNOSIS_OP_MAX = 0x08,
  GNOSIS_OP_MIN = 0x09,
  GNOSIS_OP_STORE_SLOT = 0x0A,
  GNOSIS_OP_DRAW_TEXT_CONST = 0x0B,
  GNOSIS_OP_DRAW_TEXT_BIND = 0x0C,
  GNOSIS_OP_DRAW_BAR_BIND = 0x0D,
  GNOSIS_OP_DRAW_BAR_CONST = 0x0E,
  GNOSIS_OP_DRAW_HLINE = 0x0F,
  GNOSIS_OP_DRAW_VLINE = 0x10,
  GNOSIS_OP_HALT = 0xFF,
};

typedef struct {
  const char *data;
  uint16_t len;
} GnosisStringView;

typedef struct {
  const uint8_t *blob;
  uint32_t blob_size;
  uint16_t node_count;
  uint16_t slot_count;
  uint16_t bind_count;
  uint16_t string_count;
  uint32_t code_len;
  const uint8_t *bind_section;
  const uint8_t *string_section;
  const uint8_t *slot_init_section;
  const uint8_t *code_section;
} GnosisProgram;

typedef GnosisStringView (*gnosis_resolve_text_fn)(void *ctx, uint16_t bind_id);
typedef int32_t (*gnosis_resolve_i32_fn)(void *ctx, uint16_t bind_id);
typedef void (*gnosis_draw_text_fn)(void *ctx,
                                    uint16_t x,
                                    uint16_t y,
                                    uint16_t w,
                                    uint16_t h,
                                    GnosisStringView text,
                                    uint8_t size,
                                    uint8_t color);
typedef void (*gnosis_draw_bar_fn)(void *ctx,
                                   uint16_t x,
                                   uint16_t y,
                                   uint16_t w,
                                   uint16_t h,
                                   int32_t value,
                                   int32_t max_value,
                                   uint8_t track,
                                   uint8_t fill);
typedef void (*gnosis_draw_line_fn)(void *ctx,
                                    uint16_t x,
                                    uint16_t y,
                                    uint16_t span,
                                    uint8_t color);

typedef struct {
  gnosis_resolve_text_fn resolve_text;
  gnosis_resolve_i32_fn resolve_i32;
  gnosis_draw_text_fn draw_text;
  gnosis_draw_bar_fn draw_bar;
  gnosis_draw_line_fn draw_hline;
  gnosis_draw_line_fn draw_vline;
} GnosisHooks;

bool gnosis_load_program(const uint8_t *blob, uint32_t blob_size, GnosisProgram *out_program);
bool gnosis_read_bind(const GnosisProgram *program, uint16_t index, GnosisStringView *out_string);
bool gnosis_read_string(const GnosisProgram *program, uint16_t index, GnosisStringView *out_string);
bool gnosis_eval(const GnosisProgram *program,
                 const GnosisHooks *hooks,
                 void *ctx,
                 uint16_t *slot_buffer,
                 uint16_t slot_capacity);

static inline uint16_t gnosis_slot_id(uint16_t node_id, enum GnosisField field) {
  return (uint16_t)(node_id * GNOSIS_FIELDS_PER_NODE + (uint16_t)field);
}

#ifdef __cplusplus
}
#endif

#endif
