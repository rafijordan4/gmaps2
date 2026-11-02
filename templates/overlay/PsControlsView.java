package com.virtualapplications.play;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

import org.json.JSONObject;

import java.io.InputStream;

/**
 * Kontrol ala PS yang menggantikan VirtualPadView bawaan Play!.
 * Langsung memanggil InputManager (jalur input yang sama dengan gamepad fisik).
 * Layout dinormalisasi dari referensi 1672x941, multi-touch penuh.
 */
public class PsControlsView extends View {

    private static final int UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3,
            TRIANGLE = 4, CIRCLE = 5, CROSS = 6, SQUARE = 7,
            L1 = 8, L2 = 9, R1 = 10, R2 = 11,
            SELECT = 12, START = 13, MENU = 14, COUNT = 15;

    // id kontrol -> konstanta InputManagerConstants (MENU tidak ada di PS2: buka menu emulator)
    private static final int[] PLAY_BUTTON = new int[COUNT];
    static {
        PLAY_BUTTON[UP] = InputManagerConstants.BUTTON_UP;
        PLAY_BUTTON[DOWN] = InputManagerConstants.BUTTON_DOWN;
        PLAY_BUTTON[LEFT] = InputManagerConstants.BUTTON_LEFT;
        PLAY_BUTTON[RIGHT] = InputManagerConstants.BUTTON_RIGHT;
        PLAY_BUTTON[TRIANGLE] = InputManagerConstants.BUTTON_TRIANGLE;
        PLAY_BUTTON[CIRCLE] = InputManagerConstants.BUTTON_CIRCLE;
        PLAY_BUTTON[CROSS] = InputManagerConstants.BUTTON_CROSS;
        PLAY_BUTTON[SQUARE] = InputManagerConstants.BUTTON_SQUARE;
        PLAY_BUTTON[L1] = InputManagerConstants.BUTTON_L1;
        PLAY_BUTTON[L2] = InputManagerConstants.BUTTON_L2;
        PLAY_BUTTON[R1] = InputManagerConstants.BUTTON_R1;
        PLAY_BUTTON[R2] = InputManagerConstants.BUTTON_R2;
        PLAY_BUTTON[SELECT] = InputManagerConstants.BUTTON_SELECT;
        PLAY_BUTTON[START] = InputManagerConstants.BUTTON_START;
    }

    private static final float W = 1672f, H = 941f;

    private static final class Ctl {
        final int id; final String label; final boolean round;
        final float cx, cy, hw, hh;
        boolean pressed;
        Ctl(int id, String label, boolean round, float cx, float cy, float hw, float hh) {
            this.id = id; this.label = label; this.round = round;
            this.cx = cx; this.cy = cy; this.hw = hw; this.hh = hh;
        }
    }

    private final Ctl[] ctls = new Ctl[] {
        new Ctl(L2, "L2", false, 147, 79, 91, 35),
        new Ctl(L1, "L1", false, 147, 175, 91, 35),
        new Ctl(R2, "R2", false, 1525, 79, 91, 35),
        new Ctl(R1, "R1", false, 1525, 175, 91, 35),
        new Ctl(UP, "", false, 216, 355, 50, 55),
        new Ctl(DOWN, "", false, 216, 535, 50, 55),
        new Ctl(LEFT, "", false, 127, 443, 65, 48),
        new Ctl(RIGHT, "", false, 305, 443, 65, 48),
        new Ctl(TRIANGLE, "", true, 1490, 343, 58, 58),
        new Ctl(SQUARE, "", true, 1376, 450, 58, 58),
        new Ctl(CIRCLE, "", true, 1602, 450, 58, 58),
        new Ctl(CROSS, "", true, 1490, 555, 58, 58),
        new Ctl(SELECT, "SELECT", false, 621, 849, 66, 28),
        new Ctl(START, "START", false, 1062, 849, 55, 28),
        new Ctl(MENU, "PS", true, 795, 848, 52, 52),
    };

    // pusat x, pusat y, radius luar (ruang referensi)
    private static final float[] LS = {198, 760, 122};
    private static final float[] RS = {1473, 760, 122};
    private float lsx, lsy, rsx, rsy;
    private int lsPtr = -1, rsPtr = -1;
    private final int[] ctlPtr = new int[COUNT];

    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint sym = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path tmp = new Path();
    private final RectF rf = new RectF();

    private float opacity = 0.55f;
    private boolean haptics = true;
    private float sx = 1, sy = 1;

    public PsControlsView(Context c) { super(c); init(); }
    public PsControlsView(Context c, AttributeSet a) { super(c, a); init(); }

    private void init() {
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setColor(0xFFCCCCCC);
        fill.setStyle(Paint.Style.FILL);
        text.setColor(0xFFFFFFFF);
        text.setTextAlign(Paint.Align.CENTER);
        sym.setStyle(Paint.Style.STROKE);
        for (int i = 0; i < COUNT; i++) ctlPtr[i] = -1;
        try (InputStream in = getContext().getAssets().open("gmaps2/game.json")) {
            byte[] b = new byte[in.available()];
            int n = in.read(b);
            JSONObject c = new JSONObject(new String(b, 0, Math.max(n, 0), "UTF-8")).optJSONObject("controls");
            if (c != null) {
                opacity = (float) c.optDouble("opacity", opacity);
                haptics = c.optBoolean("haptics", haptics);
            }
        } catch (Exception ignored) { }
    }

    @Override protected void onSizeChanged(int w, int h, int ow, int oh) {
        sx = w / W; sy = h / H;
    }

    // ---------- Gambar ----------
    @Override protected void onDraw(Canvas c) {
        int a = (int) (opacity * 255);
        float m = Math.min(sx, sy);
        stroke.setStrokeWidth(4f * m);
        text.setTextSize(44f * sy);

        for (Ctl k : ctls) {
            fill.setColor(k.pressed ? 0xFF666666 : 0xFF1A1A1A);
            fill.setAlpha(a);
            stroke.setAlpha(a);
            float l = (k.cx - k.hw) * sx, t = (k.cy - k.hh) * sy;
            float r = (k.cx + k.hw) * sx, b = (k.cy + k.hh) * sy;
            if (k.round) {
                float rad = Math.min(r - l, b - t) / 2f;
                c.drawCircle(k.cx * sx, k.cy * sy, rad, fill);
                c.drawCircle(k.cx * sx, k.cy * sy, rad, stroke);
                drawSymbol(c, k, rad, m);
            } else {
                rf.set(l, t, r, b);
                c.drawRoundRect(rf, 14 * sx, 14 * sy, fill);
                c.drawRoundRect(rf, 14 * sx, 14 * sy, stroke);
                if (!k.label.isEmpty()) {
                    text.setAlpha(a);
                    c.drawText(k.label, k.cx * sx, k.cy * sy + 15 * sy, text);
                } else {
                    drawArrow(c, k, m);
                }
            }
        }
        drawStick(c, LS, lsx, lsy, a, m);
        drawStick(c, RS, rsx, rsy, a, m);
    }

    private void drawSymbol(Canvas c, Ctl k, float rad, float m) {
        sym.setStrokeWidth(8f * m);
        float cx = k.cx * sx, cy = k.cy * sy, s = rad * 0.5f;
        switch (k.id) {
            case TRIANGLE:
                sym.setColor(0xFF2EDFA3); tmp.reset();
                tmp.moveTo(cx, cy - s); tmp.lineTo(cx + s, cy + s * 0.8f); tmp.lineTo(cx - s, cy + s * 0.8f); tmp.close();
                c.drawPath(tmp, sym); break;
            case CIRCLE:
                sym.setColor(0xFFF2495C); c.drawCircle(cx, cy, s, sym); break;
            case CROSS:
                sym.setColor(0xFF5B8DEF);
                c.drawLine(cx - s, cy - s, cx + s, cy + s, sym);
                c.drawLine(cx + s, cy - s, cx - s, cy + s, sym); break;
            case SQUARE:
                sym.setColor(0xFFE05FB4); c.drawRect(cx - s, cy - s, cx + s, cy + s, sym); break;
            case MENU:
                text.setAlpha(255); c.drawText("PS", cx, cy + 15 * sy, text); break;
        }
    }

    private void drawArrow(Canvas c, Ctl k, float m) {
        sym.setStyle(Paint.Style.FILL);
        sym.setColor(0xFFAAAAAA);
        float cx = k.cx * sx, cy = k.cy * sy, s = 22 * m;
        tmp.reset();
        switch (k.id) {
            case UP: tmp.moveTo(cx, cy - s); tmp.lineTo(cx + s, cy + s); tmp.lineTo(cx - s, cy + s); break;
            case DOWN: tmp.moveTo(cx, cy + s); tmp.lineTo(cx + s, cy - s); tmp.lineTo(cx - s, cy - s); break;
            case LEFT: tmp.moveTo(cx - s, cy); tmp.lineTo(cx + s, cy - s); tmp.lineTo(cx + s, cy + s); break;
            case RIGHT: tmp.moveTo(cx + s, cy); tmp.lineTo(cx - s, cy - s); tmp.lineTo(cx - s, cy + s); break;
        }
        tmp.close();
        c.drawPath(tmp, sym);
        sym.setStyle(Paint.Style.STROKE);
    }

    private void drawStick(Canvas c, float[] s, float x, float y, int a, float m) {
        float cx = s[0] * sx, cy = s[1] * sy, R = s[2] * m;
        stroke.setAlpha(a);
        c.drawCircle(cx, cy, R, stroke);
        fill.setColor(0xFF2A2A2A); fill.setAlpha(a);
        float kx = cx + x * R * 0.6f, ky = cy + y * R * 0.6f;
        c.drawCircle(kx, ky, R * 0.68f, fill);
        c.drawCircle(kx, ky, R * 0.68f, stroke);
    }

    // ---------- Sentuhan ----------
    @Override public boolean onTouchEvent(MotionEvent e) {
        int idx = e.getActionIndex();
        switch (e.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
            case MotionEvent.ACTION_POINTER_DOWN:
                down(e.getPointerId(idx), e.getX(idx), e.getY(idx)); break;
            case MotionEvent.ACTION_MOVE:
                for (int i = 0; i < e.getPointerCount(); i++) move(e.getPointerId(i), e.getX(i), e.getY(i));
                break;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_POINTER_UP:
                up(e.getPointerId(idx)); break;
            case MotionEvent.ACTION_CANCEL:
                releaseAll(); break;
        }
        invalidate();
        return true;
    }

    private boolean inStick(float[] s, float x, float y) {
        float dx = x - s[0] * sx, dy = y - s[1] * sy, R = s[2] * Math.min(sx, sy) * 1.3f;
        return dx * dx + dy * dy <= R * R;
    }

    private void down(int ptr, float x, float y) {
        if (lsPtr < 0 && inStick(LS, x, y)) { lsPtr = ptr; move(ptr, x, y); return; }
        if (rsPtr < 0 && inStick(RS, x, y)) { rsPtr = ptr; move(ptr, x, y); return; }
        float pad = 12 * Math.min(sx, sy);
        for (Ctl k : ctls) {
            if (ctlPtr[k.id] >= 0) continue;
            if (Math.abs(x - k.cx * sx) <= k.hw * sx + pad && Math.abs(y - k.cy * sy) <= k.hh * sy + pad) {
                ctlPtr[k.id] = ptr; setBtn(k, true); return;
            }
        }
    }

    private void move(int ptr, float x, float y) {
        if (ptr == lsPtr) {
            float[] v = norm(LS, x, y); lsx = v[0]; lsy = v[1];
            InputManager.setAxisState(InputManagerConstants.ANALOG_LEFT_X, lsx);
            InputManager.setAxisState(InputManagerConstants.ANALOG_LEFT_Y, lsy);
        } else if (ptr == rsPtr) {
            float[] v = norm(RS, x, y); rsx = v[0]; rsy = v[1];
            InputManager.setAxisState(InputManagerConstants.ANALOG_RIGHT_X, rsx);
            InputManager.setAxisState(InputManagerConstants.ANALOG_RIGHT_Y, rsy);
        }
    }

    private float[] norm(float[] s, float x, float y) {
        float R = s[2] * Math.min(sx, sy);
        float dx = (x - s[0] * sx) / R, dy = (y - s[1] * sy) / R;
        float len = (float) Math.sqrt(dx * dx + dy * dy);
        if (len > 1f) { dx /= len; dy /= len; }
        return new float[] {dx, dy};
    }

    private void up(int ptr) {
        if (ptr == lsPtr) {
            lsPtr = -1; lsx = lsy = 0;
            InputManager.setAxisState(InputManagerConstants.ANALOG_LEFT_X, 0f);
            InputManager.setAxisState(InputManagerConstants.ANALOG_LEFT_Y, 0f);
        }
        if (ptr == rsPtr) {
            rsPtr = -1; rsx = rsy = 0;
            InputManager.setAxisState(InputManagerConstants.ANALOG_RIGHT_X, 0f);
            InputManager.setAxisState(InputManagerConstants.ANALOG_RIGHT_Y, 0f);
        }
        for (Ctl k : ctls) if (ctlPtr[k.id] == ptr) { ctlPtr[k.id] = -1; setBtn(k, false); }
    }

    private void releaseAll() {
        up(lsPtr); up(rsPtr);
        for (Ctl k : ctls) if (ctlPtr[k.id] >= 0) up(ctlPtr[k.id]);
    }

    private void setBtn(Ctl k, boolean d) {
        k.pressed = d;
        if (d && haptics) buzz();
        if (k.id == MENU) {
            // tombol PS = buka/tutup menu emulator (simpan state, pengaturan, keluar)
            if (d && getContext() instanceof Activity) ((Activity) getContext()).onBackPressed();
            return;
        }
        InputManager.setButtonState(PLAY_BUTTON[k.id], d);
    }

    private void buzz() {
        Vibrator v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null) return;
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(12, VibrationEffect.DEFAULT_AMPLITUDE));
        else v.vibrate(12);
    }
}
