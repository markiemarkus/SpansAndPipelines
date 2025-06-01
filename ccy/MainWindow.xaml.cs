using System.Windows;
using System.Windows.Controls;
using CurrencyManager.ViewModels;
using System.Linq;
using System.Collections.Generic;
using CurrencyManager.Models;

namespace CurrencyManager
{
    public partial class MainWindow : Window
    {
        private MainViewModel _viewModel;
        private List<ListBox> _tierListBoxes;

        public MainWindow()
        {
            InitializeComponent();
            
            // Initialize ViewModel
            _viewModel = new MainViewModel();
            DataContext = _viewModel;

            // Initialize tier ListBoxes
            _tierListBoxes = new List<ListBox>
            {
                Tier1ListBox,
                Tier2ListBox,
                Tier3ListBox,
                Tier4ListBox
            };
        }

        private void ListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (sender is ListBox sourceListBox)
            {
                // Get all selected items from all tier ListBoxes
                var allSelectedItems = _tierListBoxes
                    .SelectMany(lb => lb.SelectedItems.Cast<TierMappingItem>())
                    .Distinct()
                    .ToList();

                // Update the ViewModel's selected currencies
                _viewModel.SelectedCurrencies = allSelectedItems;
            }
        }
    }
} 