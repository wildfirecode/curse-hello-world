import CurseComponent from "@core/curse/CurseComponent";
export default class FadeIn extends CurseComponent {
    duration: number = 1000;
    ease = egret.Ease.cubicOut;
    tween: egret.Tween;
    protected onCreate() {
        super.onCreate();
        this.tween = egret.Tween.get(this.host).set({ alpha: 0 })
            .to({ alpha: 1 }, this.duration, this.ease);
        this.tween.setPaused(true);
    }

    protected awake() {
        super.awake();

        this.tween.setPaused(false);
    }

    protected sleep() {
        super.sleep();

        this.tween.setPaused(true);
    }

    protected destroy() {
        super.destroy();
        egret.Tween.removeTweens(this.host);
    }
}
