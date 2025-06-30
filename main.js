// ---------------------------------
// 1. 초기 설정 및 DOM 요소 가져오기
// ---------------------------------
const form = document.getElementById('exchange-form');
const recordListBody = document.getElementById('record-list-body');
const recordRowTemplate = document.getElementById('record-row-template');

// 입력 필드 ... (이전과 동일)
const targetCurrencySelect = document.getElementById('target-currency');
const transactionTypeSelect = document.getElementById('transaction-type');
const transactionDateInput = document.getElementById('transaction-date');
const foreignAmountInput = document.getElementById('foreign-amount');
const exchangeRateInput = document.getElementById('exchange-rate');
const baseAmountInput = document.getElementById('base-amount');
const linkedBuyIdWrapper = document.getElementById('linked-buy-id-wrapper');
const linkedBuyIdSelect = document.getElementById('linked-buy-id');

// 대시보드 요소 ... (이전과 동일)
const totalPlElement = document.getElementById('total-pl');
const currentHoldingsElement = document.getElementById('current-holdings');
const avgBuyPriceElement = document.getElementById('avg-buy-price');

// [추가] 새로운 대시보드 요소
const currentMonthPlElement = document.getElementById('current-month-pl');
const monthlyPlSelect = document.getElementById('monthly-pl-select');
const monthlyPlResult = document.getElementById('monthly-pl-result');

// [추가] 로딩 오버레이 요소
const loadingOverlay = document.getElementById('loading-overlay');

// ---------------------------------
// 2. 전역 데이터 변수 및 상태
// ---------------------------------
let records = [];
let monthlyPlData = {}; // [추가] 월별 손익 데이터를 저장할 객체
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw0skZAuWgTMGOuTehPepXfIbUihjagRDQfTVaFHVjWbVC2JqRkTNNxGVtE9DMuaHi6cA/exec"; 
let editMode = { active: false, recordId: null }; // [추가] 수정 모드 상태를 관리하는 변수

// ---------------------------------
// 3. 핵심 기능 함수 (대부분 이전과 동일, renderRecords 수정)
// ---------------------------------
function calculateAndRenderAll() {
    const analytics = calculateAnalytics(records);
    monthlyPlData = analytics.monthlyPL; // 월별 손익 데이터 전역 변수에 저장

    updateDashboard(analytics);
    populateMonthSelector(analytics.monthlyPL); // [추가] 월별 드롭다운 채우기
    renderRecords(analytics.plMap, analytics.soldBuyIds);
    updateAvailableBuyOptions(analytics.soldBuyIds);
}

/**
 * 주어진 기록을 바탕으로 모든 분석 지표를 계산하는 함수
 * @param {Array} records - 전체 거래 기록 배열
 * @returns {Object} - 계산된 분석 지표들을 담은 객체
 */
function calculateAnalytics(records) {
    // 1. 분석 결과를 담을 변수들 초기화
    let totalPL = 0; // 총 실현 손익
    let currentMonthPL = 0; // 당월 실현 손익
    const monthlyPL = {}; // 월별 손익 데이터 { 'YYYY-MM': total }
    const plMap = new Map(); // 각 '판매' 기록의 개별 손익을 저장할 맵
    const soldBuyIds = new Set(); // 판매 완료된 '구매' 기록의 ID를 저장할 셋

    // 2. 계산을 위해 '구매' 기록을 ID 기반으로 빠르게 찾을 수 있도록 맵으로 만들어 둠
    const buyRecordMap = new Map(
        records
            .filter(r => r.type === 'buy')
            .map(r => [r.id.toString(), r])
    );

    // 3. 현재 날짜 정보 가져오기 (당월 손익 계산용)
    const today = new Date(); // 예시: 2025-06-30
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // "2025-06"

    // 4. 모든 '판매' 기록을 순회하며 손익 관련 지표 계산
    records
        .filter(r => r.type === 'sell' && r.linked_buy_id) // 유효한 '판매' 기록만 필터링
        .forEach(sellRecord => {
            const originalBuy = buyRecordMap.get(sellRecord.linked_buy_id.toString());
            
            // 연결된 구매 기록이 있는 경우에만 계산 수행
            if (originalBuy) {
                // 개별 손익 계산
                const profit = sellRecord.base_amount - originalBuy.base_amount;
                plMap.set(sellRecord.id.toString(), profit);

                // 총 실현 손익 누적
                totalPL += profit;

                // 판매된 '구매' 기록의 ID를 Set에 추가
                soldBuyIds.add(originalBuy.id.toString());

                // 월별 손익 계산
                const sellDate = new Date(sellRecord.timestamp);
                const sellYearMonth = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`;
                
                if (!monthlyPL[sellYearMonth]) {
                    monthlyPL[sellYearMonth] = 0;
                }
                monthlyPL[sellYearMonth] += profit;

                // 당월 손익 계산
                if (sellYearMonth === currentYearMonth) {
                    currentMonthPL += profit;
                }
            }
        });

    // 5. 보유 외화 및 평균 매입가 계산
    const holdings = {}; // 통화별 보유량 { 'USD': 100, 'JPY': 10000 }
    const buyStats = {}; // 통화별 총 매입액, 총 매입량

    records
        .filter(r => r.type === 'buy' && !soldBuyIds.has(r.id.toString())) // '구매' 기록 중 아직 판매되지 않은 것만 필터링
        .forEach(buyRecord => {
            const currency = buyRecord.target_currency;
            if (!holdings[currency]) {
                holdings[currency] = 0;
                buyStats[currency] = { totalAmount: 0, totalCost: 0 };
            }
            holdings[currency] += buyRecord.foreign_amount;
            buyStats[currency].totalAmount += buyRecord.foreign_amount;
            buyStats[currency].totalCost += buyRecord.base_amount;
        });

    // 평균 매입가 계산
    const avgBuyPrices = {};
    for (const currency in buyStats) {
        avgBuyPrices[currency] = buyStats[currency].totalCost / buyStats[currency].totalAmount;
    }
    
    // 6. 모든 분석 결과를 객체로 묶어서 반환
    return { 
        totalPL, 
        currentMonthPL,
        monthlyPL,
        plMap, 
        holdings, 
        avgBuyPrices, 
        soldBuyIds 
    };
}


/**
 * 계산된 분석 지표를 대시보드 영역에 업데이트하는 함수
 * @param {object} analytics - calculateAnalytics가 반환한 분석 결과 객체
 */
function updateDashboard({ totalPL, currentMonthPL, holdings, avgBuyPrices }) {
    // 1. 총 실현 손익 업데이트
    totalPlElement.textContent = `${totalPL.toLocaleString()} 원`;
    // 손익에 따라 클래스를 부여하여 글자색을 변경 (수익: 빨강, 손실: 파랑)
    totalPlElement.className = totalPL >= 0 ? 'profit' : 'loss';
    
    // 2. 당월 누적 손익 업데이트
    currentMonthPlElement.textContent = `${currentMonthPL.toLocaleString()} 원`;
    currentMonthPlElement.className = currentMonthPL >= 0 ? 'profit' : 'loss';

    // 3. 현재 보유 외화 정보 업데이트
    // Object.entries로 {키: 값} 형태의 객체를 [키, 값] 배열로 변환 후 map으로 순회
    const holdingsHTML = Object.entries(holdings).map(([currency, amount]) => 
        `<p>${currency}: ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>`
    ).join(''); // 각 통화별로 만들어진 <p> 태그들을 하나의 문자열로 합침
    
    // 보여줄 내용이 있으면 채워넣고, 없으면 '-' 표시
    currentHoldingsElement.innerHTML = holdingsHTML || '<p>-</p>';
    
    // 4. 통화별 평균 매입가 정보 업데이트
    const avgPricesHTML = Object.entries(avgBuyPrices).map(([currency, price]) =>
        `<p>${currency}: ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 원</p>`
    ).join('');

    // 보여줄 내용이 있으면 채워넣고, 없으면 '-' 표시
    avgBuyPriceElement.innerHTML = avgPricesHTML || '<p>-</p>';
}

/**
 * [신규] 월별 손익 드롭다운 메뉴를 생성하고 기본값을 설정하는 함수
 */
function populateMonthSelector(monthlyData) {
    monthlyPlSelect.innerHTML = ''; // 기존 옵션 초기화

    // YYYY-MM 형식의 월 목록을 최신순으로 정렬
    const sortedMonths = Object.keys(monthlyData).sort().reverse();
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11
    
    // 기본 선택될 전월(YYYY-MM) 계산
    let prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const defaultSelectedMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    if (sortedMonths.length === 0) {
        monthlyPlSelect.innerHTML = '<option>기록 없음</option>';
        monthlyPlResult.textContent = '-';
        return;
    }

    sortedMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month.replace('-', '.'); // 2025.06 형식으로 표시
        monthlyPlSelect.appendChild(option);
    });

    // 드롭다운의 기본값을 '전월'로 설정. 전월 데이터가 없으면 최신 월로 설정.
    if (sortedMonths.includes(defaultSelectedMonth)) {
        monthlyPlSelect.value = defaultSelectedMonth;
    } else {
        monthlyPlSelect.value = sortedMonths[0] || '';
    }

    // 기본 선택된 월의 손익을 표시
    displaySelectedMonthlyPL();
}

/**
 * [신규] 드롭다운에서 선택된 월의 손익을 화면에 표시하는 함수
 */
function displaySelectedMonthlyPL() {
    const selectedMonth = monthlyPlSelect.value;
    const profit = monthlyPlData[selectedMonth] || 0;
    
    monthlyPlResult.textContent = `${profit.toLocaleString()} 원`;
    monthlyPlResult.className = profit >= 0 ? 'profit' : 'loss';
}

/**
 * 테이블 목록을 렌더링하는 함수 (손익 정보 및 완료된 거래 스타일 포함)
 * @param {Map} plMap - 각 '판매' 기록의 손익 정보를 담은 맵
 * @param {Set} soldBuyIds - 판매 완료된 '구매' 기록의 ID를 담은 셋
 */
function renderRecords(plMap = new Map(), soldBuyIds = new Set()) {
    // 1. 테이블의 기존 내용을 모두 비워서 중복 표시를 방지합니다.
    recordListBody.innerHTML = '';

    // 2. 최신 기록이 맨 위에 오도록 원본 배열의 복사본을 만들어 뒤집습니다.
    const sortedRecords = [...records].reverse();

    // 3. 각 기록에 대해 반복하면서 테이블의 행(<tr>)을 만듭니다.
    sortedRecords.forEach(record => {
        // HTML 템플릿을 복제하여 새로운 행(row)의 뼈대를 만듭니다.
        const row = recordRowTemplate.content.cloneNode(true).querySelector('tr');

        // 4. [핵심 로직] 완료된 거래(판매 기록 + 연결된 구매 기록)에 사선 스타일을 적용합니다.
        if (
            (record.type === 'sell' && record.linked_buy_id) || // 이 기록이 '판매' 기록이거나,
            (record.type === 'buy' && soldBuyIds.has(record.id.toString())) // 이 '구매' 기록이 판매된 기록 목록에 포함된 경우
        ) {
            row.classList.add('record-completed');
        }

        // 5. 각 셀(td)을 찾아 데이터를 채워 넣습니다.
        const typeCell = row.querySelector('.record-type');
        if (record.type === 'buy') {
            typeCell.textContent = '구매';
            typeCell.style.color = '#3498db';
        } else {
            typeCell.textContent = '판매';
            typeCell.style.color = '#e74c3c';
        }

        // Google Sheets에서 넘어온 날짜 데이터 형식을 고려하여 'YYYY-MM-DD'로 자릅니다.
        row.querySelector('.record-date').textContent = record.timestamp.toString().substring(0, 10);
        row.querySelector('.record-currency').textContent = record.target_currency;

        // 숫자 데이터는 toLocaleString()을 사용해 콤마를 추가하고 소수점 자리를 맞춥니다.
        row.querySelector('.record-foreign-amount').textContent = Number(record.foreign_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        row.querySelector('.record-rate').textContent = Number(record.exchange_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        row.querySelector('.record-base-amount').textContent = Number(record.base_amount).toLocaleString();
        
        // 6. [핵심 로직] '판매' 기록에 대해서만 손익(P/L)을 계산하고 표시합니다.
        const plCell = row.querySelector('.record-pl');
        if (record.type === 'sell' && plMap.has(record.id.toString())) {
            const profit = plMap.get(record.id.toString());
            plCell.textContent = profit.toLocaleString();
            // 손익에 따라 'profit' 또는 'loss' 클래스를 부여하여 CSS로 색상을 제어합니다.
            plCell.classList.add(profit >= 0 ? 'profit' : 'loss');
        }

        // 7. [핵심 로직] 수정/삭제 버튼이 어떤 기록에 대한 것인지 알 수 있도록 data-id 속성에 고유 ID를 심어줍니다.
        row.querySelector('.edit-btn').dataset.id = record.id;
        row.querySelector('.delete-btn').dataset.id = record.id;
        
        // 8. 완성된 행(row)을 테이블의 tbody에 추가합니다.
        recordListBody.appendChild(row);
    });
}

// ... updateAvailableBuyOptions, calculateBaseAmount, handleTransactionTypeChange 함수는 이전과 동일 ...
function updateAvailableBuyOptions(soldBuyIds) {
    const availableBuyRecords = records.filter(r => r.type === 'buy' && !soldBuyIds.has(r.id.toString()));
    linkedBuyIdSelect.innerHTML = '<option value="">-- 원본 구매 기록 선택 --</option>';
    availableBuyRecords.forEach(r => {
        const option = document.createElement('option');
        option.value = r.id;
        const displayDate = r.timestamp.toString().substring(0, 10);
        option.textContent = `${displayDate} / ${r.target_currency} ${r.foreign_amount} (환율: ${r.exchange_rate})`;
        linkedBuyIdSelect.appendChild(option);
    });
}
function calculateBaseAmount() {
    const foreignAmount = parseFloat(foreignAmountInput.value);
    const exchangeRate = parseFloat(exchangeRateInput.value);
    if (!isNaN(foreignAmount) && !isNaN(exchangeRate)) {
        baseAmountInput.value = Math.round(foreignAmount * exchangeRate);
    } else {
        baseAmountInput.value = '';
    }
}
function handleTransactionTypeChange() {
    if (transactionTypeSelect.value === 'sell') {
        linkedBuyIdWrapper.classList.remove('hidden');
    } else {
        linkedBuyIdWrapper.classList.add('hidden');
    }
}

// [추가] 폼을 '생성 모드'로 리셋하는 함수
function resetFormToCreateMode() {
    form.reset();
    baseAmountInput.value = '';
    editMode = { active: false, recordId: null };
    form.querySelector('button[type="submit"]').textContent = '기록 저장';
    handleTransactionTypeChange();
}

// ---------------------------------
// 4. 이벤트 리스너
// ---------------------------------
foreignAmountInput.addEventListener('input', calculateBaseAmount);
exchangeRateInput.addEventListener('input', calculateBaseAmount);
transactionTypeSelect.addEventListener('change', handleTransactionTypeChange);
monthlyPlSelect.addEventListener('change', displaySelectedMonthlyPL); // [추가] 월별 손익 드롭다운 변경 이벤트

// [수정 또는 확인] 테이블의 버튼 클릭을 처리하는 이벤트 위임
recordListBody.addEventListener('click', function(event) {
    // 클릭된 요소가 버튼인지 확인하고, data-id 속성에서 레코드 ID를 가져옵니다.
    const button = event.target.closest('button'); // 클릭된 요소 또는 그 부모 중 가장 가까운 버튼을 찾음
    if (!button) return; // 버튼이 아니면 아무것도 안함

    const recordId = button.dataset.id;
    if (!recordId) return; // ID가 없는 버튼이면 무시

    // 수정 버튼(✏️)을 클릭했을 때의 로직
    if (button.classList.contains('edit-btn')) {
        const recordToEdit = records.find(r => r.id.toString() === recordId);
        if (!recordToEdit) {
            alert('수정할 기록을 찾지 못했습니다.');
            return;
        }

        // 폼에 기존 데이터를 채워 넣습니다.
        targetCurrencySelect.value = recordToEdit.target_currency;
        transactionTypeSelect.value = recordToEdit.type;
        // Google Sheets에서 받은 날짜 데이터는 시간 정보까지 포함할 수 있으므로, 앞 10자리(YYYY-MM-DD)만 사용합니다.
        transactionDateInput.value = recordToEdit.timestamp.toString().substring(0, 10);
        foreignAmountInput.value = recordToEdit.foreign_amount;
        exchangeRateInput.value = recordToEdit.exchange_rate;
        baseAmountInput.value = recordToEdit.base_amount;
        
        // '판매' 타입일 경우, '어떤 구매 건' UI를 표시하고 값을 설정합니다.
        handleTransactionTypeChange(); 
        if (recordToEdit.type === 'sell' && recordToEdit.linked_buy_id) {
            // 드롭다운이 생성될 시간을 주기 위해 짧은 지연 후 값을 설정합니다.
            setTimeout(() => { 
                linkedBuyIdSelect.value = recordToEdit.linked_buy_id; 
            }, 100);
        }
        
        // 앱을 '수정 모드'로 변경합니다.
        editMode = { active: true, recordId: recordId };
        form.querySelector('button[type="submit"]').textContent = '수정 완료';

        // 사용자가 폼을 쉽게 볼 수 있도록 화면 상단으로 스크롤합니다.
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } 
    // 삭제 버튼(🗑️)을 클릭했을 때의 로직
    else if (button.classList.contains('delete-btn')) {
        // 정말로 삭제할 것인지 사용자에게 최종 확인을 받습니다.
        if (!confirm("정말로 이 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
        
        // 로딩 화면을 보여줄 수 있습니다. (선택사항)
        loadingOverlay.classList.remove('hidden');

        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: recordId }),
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                // 로컬 데이터 배열에서 삭제된 기록을 제거합니다.
                records = records.filter(r => r.id.toString() !== result.id.toString());
                // 변경된 데이터로 화면 전체를 다시 그립니다.
                calculateAndRenderAll();
            } else {
                throw new Error(result.message);
            }
        })
        .catch(error => alert(`삭제에 실패했습니다: ${error.message}`))
        .finally(() => {
            loadingOverlay.classList.add('hidden'); // 로딩 화면 숨기기
        });
    }
});


form.addEventListener('submit', function(event) {
    // 1. 폼 제출 시 페이지가 새로고침되는 기본 동작을 막습니다.
    event.preventDefault();

    // 2. 중복 제출을 방지하기 위해 버튼을 비활성화하고 로딩 상태로 변경합니다.
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = '저장 중...';
    loadingOverlay.classList.remove('hidden'); // 로딩 화면 보이기

    // 3. 현재 폼의 상태가 '수정 모드'인지 '생성 모드'인지에 따라 작업(action)과 ID를 결정합니다.
    const action = editMode.active ? 'update' : 'create';
    const recordId = editMode.active ? editMode.recordId : 't' + Date.now();

    // 4. 폼에 입력된 값들을 기반으로 데이터 객체를 생성합니다.
    const recordData = {
        id: recordId,
        type: transactionTypeSelect.value,
        timestamp: transactionDateInput.value,
        target_currency: targetCurrencySelect.value,
        foreign_amount: parseFloat(foreignAmountInput.value),
        exchange_rate: parseFloat(exchangeRateInput.value),
        base_amount: parseInt(baseAmountInput.value, 10),
        linked_buy_id: transactionTypeSelect.value === 'sell' ? linkedBuyIdSelect.value : null,
    };

    // 5. fetch를 사용하여 Apps Script에 데이터를 전송합니다.
    fetch(SCRIPT_URL, {
        method: 'POST',
        // 'action'과 실제 데이터를 함께 묶어서 JSON 문자열로 만들어 보냅니다.
        body: JSON.stringify({ action: action, data: recordData }),
    })
    .then(response => response.json())
    .then(result => {
        // 6. Apps Script로부터 성공 응답을 받았을 때의 처리
        if (result.status === 'success') {
            if (action === 'create') {
                // '생성'이었으면, 로컬 records 배열에 새 데이터를 추가합니다.
                records.push(result.data);
            } else { // '수정'이었으면,
                // 로컬 records 배열에서 기존 데이터를 찾아 새 데이터로 교체합니다.
                const index = records.findIndex(r => r.id.toString() === result.data.id.toString());
                if (index > -1) {
                    records[index] = result.data;
                }
            }
            // 모든 데이터를 다시 계산하고 화면을 새로고침합니다.
            calculateAndRenderAll();
            // 폼을 '생성 모드'로 초기화합니다.
            resetFormToCreateMode();
        } else {
            // Apps Script에서 에러를 보냈을 경우
            throw new Error(result.message || '알 수 없는 에러 발생');
        }
    })
    .catch(error => {
        // 7. 네트워크 에러 등 작업 실패 시 처리
        console.error('작업 처리 중 에러 발생:', error);
        alert(`작업에 실패했습니다: ${error.message}`);
    })
    .finally(() => {
        // 8. 성공하든 실패하든 항상 마지막에 실행될 처리
        // 버튼을 다시 활성화하고 로딩 화면을 숨깁니다.
        submitButton.disabled = false;
        // 폼 상태에 맞게 버튼 텍스트를 복원합니다.
        if (!editMode.active) {
            submitButton.textContent = '기록 저장';
        } else {
             submitButton.textContent = '수정 완료';
        }
        loadingOverlay.classList.add('hidden');
    });
});


// [추가] 테이블의 버튼 클릭을 처리하는 이벤트 위임
recordListBody.addEventListener('click', function(event) {
    const target = event.target;
    const recordId = target.dataset.id;

    if (!recordId) return;

    if (target.classList.contains('edit-btn')) {
        // 수정 버튼 클릭 시
        const recordToEdit = records.find(r => r.id.toString() === recordId);
        if (!recordToEdit) return;

        // 폼에 데이터 채우기
        targetCurrencySelect.value = recordToEdit.target_currency;
        transactionTypeSelect.value = recordToEdit.type;
        transactionDateInput.value = recordToEdit.timestamp.toString().substring(0, 10);
        foreignAmountInput.value = recordToEdit.foreign_amount;
        exchangeRateInput.value = recordToEdit.exchange_rate;
        baseAmountInput.value = recordToEdit.base_amount;
        handleTransactionTypeChange();
        if (recordToEdit.type === 'sell') {
            // 연결된 구매 ID를 선택 상태로 만들기 (시간이 좀 걸릴 수 있음)
            setTimeout(() => { linkedBuyIdSelect.value = recordToEdit.linked_buy_id; }, 100);
        }
        
        // 수정 모드로 변경
        editMode = { active: true, recordId: recordId };
        form.querySelector('button[type="submit"]').textContent = '수정 완료';
        window.scrollTo({ top: 0, behavior: 'smooth' }); // 화면 상단으로 스크롤
    } else if (target.classList.contains('delete-btn')) {
        // 삭제 버튼 클릭 시
        if (!confirm("정말로 이 기록을 삭제하시겠습니까?")) return;
        
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: recordId }),
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                records = records.filter(r => r.id.toString() !== result.id.toString());
                calculateAndRenderAll();
            } else {
                throw new Error(result.message);
            }
        })
        .catch(error => alert(`삭제에 실패했습니다: ${error.message}`));
    }
});

// ---------------------------------
// 5. 초기 실행
// ---------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. SCRIPT_URL이 제대로 입력되었는지 먼저 확인합니다.
    if (SCRIPT_URL.includes("여기에_본인의_웹_앱_URL을_붙여넣어주세요")) {
        alert("main.js 파일의 SCRIPT_URL 변수에 본인의 웹 앱 URL을 먼저 입력해주세요!");
        return; // URL이 없으면 여기서 실행을 중단합니다.
    }
  
    // 2. 데이터를 불러오기 시작했음을 사용자에게 알리기 위해 로딩 화면을 보여줍니다.
    loadingOverlay.classList.remove('hidden');
    
    // 3. fetch를 사용해 Google Apps Script에 데이터를 요청합니다. (GET 요청)
    fetch(SCRIPT_URL)
        .then(response => response.json()) // 응답을 JSON 형태로 파싱합니다.
        .then(data => {
            // 4. [성공 시] 데이터를 성공적으로 받아왔을 때의 처리
            console.log("Google Sheets에서 데이터를 성공적으로 불러왔습니다:", data);
            
            // 받아온 데이터를 전역 변수 records에 저장합니다.
            records = data; 
            
            // 모든 분석과 화면 그리기를 수행하는 메인 함수를 호출합니다.
            calculateAndRenderAll(); 
            
            // 초기 '거래 종류'에 맞춰 UI를 설정합니다.
            handleTransactionTypeChange(); 
        })
        .catch(error => {
            // 5. [실패 시] 데이터를 불러오는 데 실패했을 때의 처리
            console.error('데이터를 불러오는 중 에러 발생:', error);
            alert('데이터를 불러오는 데 실패했습니다. Apps Script 배포나 URL을 확인해주세요.');
        })
        .finally(() => {
            // 6. [항상 실행] 성공하든 실패하든, 모든 작업이 끝나면 로딩 화면을 숨깁니다.
            loadingOverlay.classList.add('hidden');
        });
// 바로 아래 }); 이 부분이 누락되었을 가능성이 매우 높습니다.
});