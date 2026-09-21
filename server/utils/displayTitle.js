// 매물 제목(title)은 판매자가 직접 쓰는 자유 텍스트 칼럼으로 남겨둔다(지금은 등록 폼에 입력칸이
// 없어 항상 비어 있지만, 나중에 "판매자 코멘트" 같은 기능이 붙을 자리다) — 서버가 이 칼럼 값을
// 덮어쓰지 않는다. 화면에 보여줄 제목은 트림 계보 + 최초등록연도로 매 응답마다 계산해서
// display_title 필드로만 내려준다. car.title은 그대로, car.trim_name은 응답에서 제거한다.
//
// 매물을 반환하는 라우터(cars, favorites)가 모두 이 함수를 쓴다 — 하나만 빼먹으면 그 화면은
// display_title이 없어 제목이 안 뜬다 (favorites 라우터에서 실제로 발생했던 문제).
function withDisplayTitle(car) {
  const { trim_name, ...rest } = car;
  return { ...rest, display_title: `${car.brand} ${car.model} ${trim_name} (${car.first_registered_year}년식)` };
}

module.exports = { withDisplayTitle };
