/**
 * SignOS UI Component Builder (v1.0)
 * Agnostic generators for Swatches, Grids, and Shared Frontend Components
 */

window.SignOS_UI = {
    
    // Builds a dynamic color grid for Paint, Rowmark, or Vinyl
    buildColorGrid: function(config) {
        const grid = document.getElementById(config.containerId);
        if(!grid) return;
        grid.innerHTML = '';

        // Optional Custom Manual Entry Button
        if(config.showCustom) {
            const customBtn = document.createElement('button');
            customBtn.className = "w-full py-1.5 mb-1 rounded border border-gray-300 bg-white text-[10px] font-bold text-gray-600 shadow-sm hover:border-orange-500 transition focus:outline-none uppercase shrink-0";
            customBtn.innerText = "+ Custom Match...";
            customBtn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-orange-500');
                customBtn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-orange-500', 'border-transparent');
                if(config.onCustom) config.onCustom();
            };
            grid.appendChild(customBtn);
        }

        const fragment = document.createDocumentFragment();
        
        config.data.forEach(item => {
            const btn = document.createElement('button');
            btn.className = `w-8 h-8 rounded border border-gray-300 shadow-sm hover:scale-110 transition focus:outline-none relative group overflow-hidden shrink-0 ${config.btnClass || ''}`;

            let bgStyle = '';
            let title = '';
            let searchData = '';

            // Map data based on the substrate type requested
            if (config.type === 'rowmark') {
                let cap = item.Cap_Hex || '#000000';
                let core = item.Core_Hex || '#FFFFFF';
                bgStyle = config.isReverse ? cap : `linear-gradient(135deg, ${cap} 50%, ${core} 50%)`;
                title = `${item.Item_Code} - ${item.Cap_Color}`;
                searchData = title.toLowerCase();
            } 
            else if (config.type === 'paint' || config.type === 'vinyl') {
                bgStyle = item.Hex_Code || '#FFFFFF';
                let code = item.Code || item.Color_Code || '';
                let name = item.Name || item.Display_Name || '';
                title = `${name} (${code})`;
                searchData = title.toLowerCase();
                if(config.type === 'paint') btn.classList.add('rounded-full'); // Paint gets circles
            }

            btn.style.background = bgStyle;
            btn.title = title;
            btn.dataset.search = searchData;

            btn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-blue-500');
                btn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-blue-500', 'border-transparent');
                if(config.onSelect) config.onSelect(item);
            };

            fragment.appendChild(btn);
        });
        
        grid.appendChild(fragment);
    },

    _clearActive: function(grid, ringClass) {
        Array.from(grid.children).forEach(b => b.classList.remove('ring-2', 'ring-offset-1', ringClass, 'border-transparent'));
    },

    // Global Search Filter for generated grids
    filterGrid: function(containerId, searchInputId) {
        const grid = document.getElementById(containerId);
        const input = document.getElementById(searchInputId);
        if(!grid || !input) return;
        
        const q = input.value.toLowerCase();
        Array.from(grid.children).forEach(btn => {
            if(!btn.dataset.search) return; // Skips the 'Custom' button
            if(btn.dataset.search.includes(q)) btn.style.display = 'block';
            else btn.style.display = 'none';
        });
    }
};
