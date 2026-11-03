# models

솔리드웍스에서 내보낸 GLB 파일을 이 폴더에 넣고 `js/config.js` 의 `products` 에서 `glb` 경로를 적으세요.

- `ormi.glb` → 오르미캣타워
- `custom-b.glb` → 커스텀B 월캣타워
- `catwalk.glb` → 월스텝 선반
- `cathouse.glb` → 2층 숨숨집

단위가 mm 이면 `scale: 0.001`. 앞면 +Z, 바닥 y=0 기준입니다. 고양이가 오르는 자리는 `js/products.js` 의 `*_NAV` 좌표를 씁니다.
