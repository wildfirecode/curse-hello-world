import CurseComponent from "@core/curse/CurseComponent";
import { delayLoad } from "../Utils";
import Breath from './Breath';
import BuriedPointButton from './BuriedPointButton';
import FadeIn from './FadeIn';

const createComponent = (cls, host, options) => {
	const component = new cls();
	component.host = host;
	for (const key in options) {
		if (options.hasOwnProperty(key)) {
			const val = options[key];
			component[key] = val;
		}
	}
	component.onCreate();
	return component;
}

export default class SceneMenu extends CurseComponent {
	btnStart: eui.Button = null;
	protected onCreate() {
		super.onCreate();

		this.components = this.component || [];

		const breath = createComponent(Breath, this.btnStart, {
			duration: 1000,
			scaleOffset: 0.1
		});

		const buriedPointButton = createComponent(BuriedPointButton, this.btnStart, {
			dpm: "app_id.202.7.1",
			dcm: "213.oaid.0.0"
		});

		const fadeIn = createComponent(FadeIn, this.btnStart, {
			duration: 2000,
			ease: egret.Ease.cubicOut
		});

		this.components.push(breath, buriedPointButton, fadeIn);

		delayLoad();
	}

	protected awake() {
		super.awake();
		this.components.forEach(component => component.awake());
	}

	protected sleep() {
		super.sleep();
		this.components.forEach(component => component.awake());

	}

	protected destroy() {
		super.destroy();
	}
}
