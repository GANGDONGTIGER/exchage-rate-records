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

// ---------------------------------
// 2. 전역 데이터 변수 및 상태
// ---------------------------------
let records = [];
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw0skZAuWgTMGOuTehPepXfIbUihjagRDQfTVaFHVjWbVC2JqRkTNNxGVtE9DMuaHi6cA/exec"; 
let editMode = { active: false, recordId: null }; // [추가] 수정 모드 상태를 관리하는 변수

// ---------------------------------
// 3. 핵심 기능 함수 (대부분 이전과 동일, renderRecords 수정)
// ---------------------------------
function calculateAndRenderAll() {
    const analytics = calculateAnalytics(records);
    updateDashboard(analytics);
    renderRecords(analytics.plMap, analytics.soldBuyIds);
    updateAvailableBuyOptions(analytics.soldBuyIds);
}

// ... calculateAnalytics, updateDashboard 함수는 이전과 동일 ...
function calculateAnalytics(records) {
    let totalPL = 0;
    const plMap = new Map();
    const buyRecordMap = new Map(records.filter(r => r.type === 'buy').map(r => [r.id.toString(), r]));
    const soldBuyIds = new Set();
    records.filter(r => r.type === 'sell' && r.linked_buy_id).forEach(sellRecord => {
        const originalBuy = buyRecordMap.get(sellRecord.linked_buy_id.toString());
        if (originalBuy) {
            const profit = sellRecord.base_amount - originalBuy.base_amount;
            totalPL += profit;
            plMap.set(sellRecord.id.toString(), profit);
            soldBuyIds.add(originalBuy.id.toString());
        }
    });
    const holdings = {};
    const buyStats = {};
    records.filter(r => r.type === 'buy' && !soldBuyIds.has(r.id.toString())).forEach(buyRecord => {
        const currency = buyRecord.target_currency;
        if (!holdings[currency]) {
            holdings[currency] = 0;
            buyStats[currency] = { totalAmount: 0, totalCost: 0 };
        }
        holdings[currency] += buyRecord.foreign_amount;
        buyStats[currency].totalAmount += buyRecord.foreign_amount;
        buyStats[currency].totalCost += buyRecord.base_amount;
    });
    const avgBuyPrices = {};
    for (const currency in buyStats) {
        avgBuyPrices[currency] = buyStats[currency].totalCost / buyStats[currency].totalAmount;
    }
    return { totalPL, plMap, holdings, avgBuyPrices, soldBuyIds };
}
function updateDashboard({ totalPL, holdings, avgBuyPrices }) {
    totalPlElement.textContent = `${totalPL.toLocaleString()} 원`;
    totalPlElement.className = totalPL >= 0 ? 'profit' : 'loss';
    currentHoldingsElement.innerHTML = Object.entries(holdings).map(([currency, amount]) => `<p>${currency}: ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>`).join('') || '<p>-</p>';
    avgBuyPriceElement.innerHTML = Object.entries(avgBuyPrices).map(([currency, price]) => `<p>${currency}: ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 원</p>`).join('') || '<p>-</p>';
}

// [수정] renderRecords 함수에 수정/삭제 버튼에 data-id 추가하는 로직 포함
function renderRecords(plMap = new Map(), soldBuyIds = new Set()) {
    recordListBody.innerHTML = '';
    const sortedRecords = [...records].reverse();
    sortedRecords.forEach(record => {
        const row = recordRowTemplate.content.cloneNode(true).querySelector('tr');
        if ((record.type === 'sell' && record.linked_buy_id) || (record.type === 'buy' && soldBuyIds.has(record.id.toString()))) {
            row.classList.add('record-completed');
        }
        // ... type, date, currency 등 셀 채우는 로직은 이전과 동일 ...
        const typeCell = row.querySelector('.record-type');
        if (record.type === 'buy') {
            typeCell.textContent = '구매'; typeCell.style.color = '#3498db';
        } else {
            typeCell.textContent = '판매'; typeCell.style.color = '#e74c3c';
        }
        row.querySelector('.record-date').textContent = record.timestamp.toString().substring(0, 10);
        row.querySelector('.record-currency').textContent = record.target_currency;
        row.querySelector('.record-foreign-amount').textContent = Number(record.foreign_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        row.querySelector('.record-rate').textContent = Number(record.exchange_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        row.querySelector('.record-base-amount').textContent = Number(record.base_amount).toLocaleString();
        const plCell = row.querySelector('.record-pl');
        if (record.type === 'sell' && plMap.has(record.id.toString())) {
            const profit = plMap.get(record.id.toString());
            plCell.textContent = profit.toLocaleString();
            plCell.classList.add(profit >= 0 ? 'profit' : 'loss');
        }

        // [추가] 버튼에 데이터 ID 심어주기
        row.querySelector('.edit-btn').dataset.id = record.id;
        row.querySelector('.delete-btn').dataset.id = record.id;
        
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
// 4. 이벤트 리스너 (수정/삭제 로직 추가)
// ---------------------------------
foreignAmountInput.addEventListener('input', calculateBaseAmount);
exchangeRateInput.addEventListener('input', calculateBaseAmount);
transactionTypeSelect.addEventListener('change', handleTransactionTypeChange);

// [수정] 폼 제출 이벤트 핸들러: 생성과 수정을 모두 처리
form.addEventListener('submit', function(event) {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = '저장 중...';

    const recordData = {
        id: editMode.active ? editMode.recordId : 't' + Date.now(),
        type: transactionTypeSelect.value,
        timestamp: transactionDateInput.value,
        target_currency: targetCurrencySelect.value,
        foreign_amount: parseFloat(foreignAmountInput.value),
        exchange_rate: parseFloat(exchangeRateInput.value),
        base_amount: parseInt(baseAmountInput.value, 10),
        linked_buy_id: transactionTypeSelect.value === 'sell' ? linkedBuyIdSelect.value : null,
    };

    const action = editMode.active ? 'update' : 'create';

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: action, data: recordData }),
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            if (action === 'create') {
                records.push(result.data);
            } else { // update
                const index = records.findIndex(r => r.id.toString() === result.data.id.toString());
                if (index > -1) records[index] = result.data;
            }
            calculateAndRenderAll();
            resetFormToCreateMode();
        } else {
            throw new Error(result.message || '알 수 없는 에러 발생');
        }
    })
    .catch(error => alert(`작업에 실패했습니다: ${error.message}`))
    .finally(() => {
        submitButton.disabled = false;
        if (!editMode.active) {
            submitButton.textContent = '기록 저장';
        } else {
            submitButton.textContent = '수정 완료';
        }
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
    if (SCRIPT_URL.includes("여기에_본인의_웹_앱_URL을_붙여넣어주세요")) {
        alert("main.js 파일의 SCRIPT_URL 변수에 본인의 웹 앱 URL을 먼저 입력해주세요!"); return;
    }
    fetch(SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            records = data;
            calculateAndRenderAll();
            handleTransactionTypeChange();
        })
        .catch(error => alert(`데이터를 불러오는 데 실패했습니다: ${error.message}`));
});