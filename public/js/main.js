$(document).ready(function() {
    // Back to Top Button functionality
    const backToTopBtn = $('.back-to-top');
    
    // Show/hide button based on scroll position
    $(window).scroll(function() {
        if ($(this).scrollTop() > 300) {
            backToTopBtn.addClass('show');
        } else {
            backToTopBtn.removeClass('show');
        }
    });
    
    // Smooth scroll to top when button is clicked
    backToTopBtn.on('click', function() {
        $('html, body').animate({
            scrollTop: 0
        }, 600);
    });
    
    // Cart page quantity buttons
    $('.quantity-btn').on('click', function() {
        const productId = $(this).data('product-id');
        const action = $(this).data('action');
        const input = $(this).closest('.input-group').find('.quantity-input');
        let quantity = parseInt(input.val());
        
        if (action === 'increase') {
            quantity++;
        } else if (action === 'decrease' && quantity > 1) {
            quantity--;
        }
        
        // Update quantity in cart
        $.ajax({
            url: '/cart/update-quantity',
            method: 'POST',
            data: { productId, quantity },
            success: function(response) {
                if (response.success) {
                    // Update the display
                    input.val(quantity);
                    
                    // Update the item subtotal
                    const row = input.closest('tr');
                    row.find('.item-subtotal').text('$' + response.itemTotal);
                    
                    // Update the cart totals
                    updateCartSummary(response.cartTotal);
                }
            }
        });
    });
    
    // Remove item button
    $('.remove-item-btn').on('click', function() {
        const productId = $(this).data('product-id');
        const row = $(this).closest('tr');
        
        $.ajax({
            url: '/cart/remove',
            method: 'POST',
            data: { productId },
            success: function(response) {
                if (response.success) {
                    // Remove the row
                    row.fadeOut(300, function() {
                        $(this).remove();
                        
                        // Update the cart count and totals
                        updateCartCount(response.cartCount);
                        updateCartSummary(response.cartTotal);
                        
                        // If cart is empty, refresh the page to show empty cart message
                        if (response.cartCount === 0) {
                            location.reload();
                        }
                    });
                }
            }
        });
    });
    
    // Clear cart button
    $('#clear-cart').on('click', function() {
        if (confirm('Are you sure you want to clear your cart?')) {
            $.ajax({
                url: '/cart/clear',
                method: 'POST',
                success: function(response) {
                    if (response.success) {
                        location.reload();
                    }
                }
            });
        }
    });
    
    // Quantity buttons on product detail page
    $('#increaseQty').on('click', function() {
        const input = $('#quantity');
        const currentValue = parseInt(input.val());
        input.val(currentValue + 1);
    });
    
    $('#decreaseQty').on('click', function() {
        const input = $('#quantity');
        const currentValue = parseInt(input.val());
        if (currentValue > 1) {
            input.val(currentValue - 1);
        }
    });
    
    // Add to cart buttons on product pages
    $('.add-to-cart-btn').on('click', function() {
        const productId = $(this).data('product-id');
        const quantity = $('#quantity-input').val() || 1;
        
        $.ajax({
            url: '/cart/add',
            method: 'POST',
            data: { productId, quantity },
            success: function(response) {
                if (response.success) {
                    // Show success message with SweetAlert2
                    showCartSuccessAlert('Your product has been successfully added to your cart.');
                    
                    // Update cart count
                    updateCartCount(response.cartCount);
                }
            },
            error: function() {
                showCartErrorAlert('Failed to add product to cart.');
            }
        });
    });
    
    // Add to cart button on product detail page
    $('.add-to-cart-detail').on('click', function() {
        const productId = $(this).data('product-id');
        const quantity = $('#quantity').val() || 1;
        
        $.ajax({
            url: '/cart/add',
            method: 'POST',
            data: { productId, quantity },
            success: function(response) {
                if (response.success) {
                    // Show success message with SweetAlert2
                    showCartSuccessAlert('Your product has been successfully added to your cart.');
                    
                    // Update cart count
                    updateCartCount(response.cartCount);
                }
            },
            error: function() {
                showCartErrorAlert('Failed to add product to cart.');
            }
        });
    });
    
    // Toggle wishlist buttons
    $('.toggle-wishlist-btn').on('click', function() {
        const btn = $(this);
        const productId = btn.data('product-id');
        const isInWishlist = btn.hasClass('in-wishlist');
        
        // Check if user is logged in
        const isLoggedIn = Boolean($('body').data('user-id'));
        
        if (!isLoggedIn) {
            // If not logged in, redirect to login page
            window.location.href = '/users/login?returnUrl=' + encodeURIComponent(window.location.pathname);
            return;
        }
        
        if (isInWishlist) {
            // Remove from wishlist
            $.ajax({
                url: '/wishlist/remove/' + productId,
                method: 'DELETE',
                success: function(response) {
                    if (response.success) {
                        // Update button appearance
                        btn.removeClass('in-wishlist');
                        btn.find('i').removeClass('fas text-danger').addClass('far');
                        
                        // Update wishlist count in header
                        updateWishlistCount(response.wishlistCount);
                        
                        // Show success message
                        showAlert('success', 'Product removed from wishlist!');
                    }
                },
                error: function() {
                    showAlert('danger', 'Failed to remove product from wishlist.');
                }
            });
        } else {
            // Add to wishlist
            $.ajax({
                url: '/wishlist/add/' + productId,
                method: 'POST',
                success: function(response) {
                    if (response.success) {
                        // Update button appearance
                        btn.addClass('in-wishlist');
                        btn.find('i').removeClass('far').addClass('fas text-danger');
                        
                        // Update wishlist count in header
                        updateWishlistCount(response.wishlistCount);
                        
                        // Show success message
                        showAlert('success', 'Product added to wishlist!');
                    }
                },
                error: function() {
                    showAlert('danger', 'Failed to add product to wishlist.');
                }
            });
        }
    });
    
    // Checkout button
    $('#checkout-btn').on('click', function() {
        // Check if user is logged in
        const isLoggedIn = Boolean($('body').data('user-id'));
        
        if (!isLoggedIn) {
            // If not logged in, redirect to login page with returnUrl
            window.location.href = '/users/login?returnUrl=' + encodeURIComponent('/cart/checkout');
            return;
        }
        
        // If logged in, proceed to checkout
        window.location.href = '/cart/checkout';
    });
    
    // Search Overlay Functionality
    const searchToggle = $('#searchToggle');
    const searchOverlay = $('#searchOverlay');
    const searchClose = $('#searchClose');
    const searchInput = $('#searchInput');
    
    // Open search overlay
    searchToggle.on('click', function() {
        searchOverlay.addClass('show');
        setTimeout(() => {
            searchInput.focus();
        }, 300);
    });
    
    // Close search overlay
    searchClose.on('click', function() {
        searchOverlay.removeClass('show');
        searchInput.val('');
    });
    
    // Close search overlay on escape key
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape' && searchOverlay.hasClass('show')) {
            searchOverlay.removeClass('show');
            searchInput.val('');
        }
    });
    
    // Close search overlay on background click
    searchOverlay.on('click', function(e) {
        if (e.target === searchOverlay[0]) {
            searchOverlay.removeClass('show');
            searchInput.val('');
        }
    });
    
    // Handle search form submission
    $('.search-form').on('submit', function(e) {
        // Allow the form to submit naturally, just hide the overlay after a short delay
        setTimeout(() => {
            searchOverlay.removeClass('show');
            searchInput.val('');
        }, 100);
    });
    
    // Video Play Functionality
    function playVideo(videoId) {
        // In a real implementation, this would open a video modal or navigate to video page
        console.log('Playing video:', videoId);
        
        // For now, we'll show an alert indicating video would play
        Swal.fire({
            icon: 'info',
            title: 'Video Player',
            text: `Video "${videoId}" would play here in a real implementation.`,
            showConfirmButton: true,
            confirmButtonText: 'OK',
            confirmButtonColor: '#007bff'
        });
    }
    
    // Helper functions
    function updateCartCount(count) {
        $('.cart-count').text(count);
    }
    
    function updateWishlistCount(count) {
        $('.wishlist-count').text(count);
    }
    
    function updateCartSummary(total) {
        // Update subtotal
        $('#cart-subtotal').text('$' + total);
        
        // Update tax (10% of subtotal)
        const tax = (parseFloat(total) * 0.1).toFixed(2);
        $('#cart-tax').text('$' + tax);
        
        // Update total (subtotal + tax)
        const grandTotal = (parseFloat(total) * 1.1).toFixed(2);
        $('#cart-total').text('$' + grandTotal);
    }
    
    // SweetAlert2 success popup for cart operations
    function showCartSuccessAlert(message = 'Product added to cart!') {
        Swal.fire({
            icon: 'success',
            title: 'Product Added!',
            text: message,
            showConfirmButton: true,
            confirmButtonText: 'OK',
            confirmButtonColor: '#28a745',
            allowOutsideClick: false,
            allowEscapeKey: false
        });
    }
    
    // SweetAlert2 error popup for cart operations
    function showCartErrorAlert(message = 'Something went wrong. Please try again.') {
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: message,
            showConfirmButton: true,
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc3545'
        });
    }
    
    // Generic SweetAlert2 success popup
    function showSuccessAlert(message) {
        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: message,
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: true,
            confirmButtonText: 'OK',
            confirmButtonColor: '#28a745'
        });
    }
    
    // Generic SweetAlert2 error popup
    function showErrorAlert(message) {
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: message,
            showConfirmButton: true,
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc3545'
        });
    }
    
    // Legacy showAlert function for backward compatibility
    function showAlert(type, message) {
        if (type === 'success') {
            showSuccessAlert(message);
        } else if (type === 'danger' || type === 'error') {
            showErrorAlert(message);
        } else {
            // Fallback to generic success for other types
            showSuccessAlert(message);
        }
    }
    
    // Countdown Timer for Sale Section
    function initCountdownTimer() {
        const countdownElement = $('#countdown-timer');
        
        // Only initialize if countdown element exists
        if (countdownElement.length === 0) {
            return;
        }
        
        // Set the end date (30 days from now)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        endDate.setHours(23, 59, 59, 999);
        
        function updateCountdown() {
            const now = new Date().getTime();
            const distance = endDate.getTime() - now;
            
            if (distance < 0) {
                // Countdown finished, reset to 30 days
                endDate.setDate(endDate.getDate() + 30);
                return;
            }
            
            // Calculate time units
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            // Update the display with zero padding
            $('#days').text(String(days).padStart(2, '0'));
            $('#hours').text(String(hours).padStart(2, '0'));
            $('#minutes').text(String(minutes).padStart(2, '0'));
            $('#seconds').text(String(seconds).padStart(2, '0'));
        }
        
        // Update immediately
        updateCountdown();
        
        // Update every second
        setInterval(updateCountdown, 1000);
    }
    
    // Initialize countdown timer
    initCountdownTimer();
    
    // Carousel Animation Handler - Production Ready
    const carousel = document.getElementById('carouselHero');
    if (carousel) {
        const carouselItems = carousel.querySelectorAll('.carousel-item');
        const totalSlides = carouselItems.length;
        let currentSlide = 0;
        let autoSlideInterval = null;
        const slideInterval = 5000; // 5 seconds
        
        // Initialize Bootstrap carousel
        const bsCarousel = new bootstrap.Carousel(carousel, {
            interval: false, // Disable Bootstrap auto-slide
            wrap: true
        });
        
        // Function to reset all animations
        function resetAnimations() {
            carouselItems.forEach(item => {
                const img = item.querySelector('img');
                const caption = item.querySelector('.carousel-caption');
                
                if (img) {
                    img.style.animation = 'none';
                    void img.offsetWidth; // Force reflow
                }
                
                if (caption) {
                    const h2 = caption.querySelector('h2');
                    const p = caption.querySelector('p');
                    const btn = caption.querySelector('.btn');
                    
                    if (h2) {
                        h2.style.animation = 'none';
                        h2.style.opacity = '0';
                        h2.style.transform = 'translateY(30px)';
                    }
                    if (p) {
                        p.style.animation = 'none';
                        p.style.opacity = '0';
                        p.style.transform = 'translateY(30px)';
                    }
                    if (btn) {
                        btn.style.animation = 'none';
                        btn.style.opacity = '0';
                        btn.style.transform = 'translateY(30px)';
                    }
                }
            });
        }
        
        // Function to trigger animations for active slide
        function triggerActiveAnimations() {
            const activeItem = carousel.querySelector('.carousel-item.active');
            if (!activeItem) return;
            
            const img = activeItem.querySelector('img');
            const caption = activeItem.querySelector('.carousel-caption');
            
            // Reset and trigger image animation immediately
            if (img) {
                img.style.animation = 'none';
                void img.offsetWidth; // Force reflow
                // Start animation immediately with faster timing
                img.style.animation = 'slideImageIn 0.6s ease-out forwards, floatImage 6s ease-in-out infinite 0.8s';
            }
            
            // Trigger text animations with shorter delays
            if (caption) {
                const h2 = caption.querySelector('h2');
                const p = caption.querySelector('p');
                const btn = caption.querySelector('.btn');
                
                if (h2) {
                    h2.style.animation = 'fadeUpIn 0.6s ease-out 0.2s forwards';
                }
                if (p) {
                    p.style.animation = 'fadeUpIn 0.6s ease-out 0.4s forwards';
                }
                if (btn) {
                    btn.style.animation = 'fadeUpIn 0.6s ease-out 0.6s forwards';
                }
            }
        }
        
        // Function to go to next slide
        function goToNextSlide() {
            currentSlide = (currentSlide + 1) % totalSlides;
            bsCarousel.to(currentSlide);
        }
        
        // Function to start auto-slide
        function startAutoSlide() {
            stopAutoSlide(); // Clear any existing interval
            autoSlideInterval = setInterval(goToNextSlide, slideInterval);
        }
        
        // Function to stop auto-slide
        function stopAutoSlide() {
            if (autoSlideInterval) {
                clearInterval(autoSlideInterval);
                autoSlideInterval = null;
            }
        }
        
        // Initialize on page load - immediate
        resetAnimations();
        triggerActiveAnimations();
        startAutoSlide();
        
        // Handle Bootstrap carousel events
        carousel.addEventListener('slide.bs.carousel', function (e) {
            // Reset animations before slide
            resetAnimations();
        });
        
        carousel.addEventListener('slid.bs.carousel', function (e) {
            // Update current slide index
            const activeIndex = Array.from(carouselItems).indexOf(e.relatedTarget);
            currentSlide = activeIndex;
            
            // Trigger animations immediately - no delay
            triggerActiveAnimations();
            
            // Restart auto-slide
            startAutoSlide();
        });
        
        // Pause auto-slide on hover
        carousel.addEventListener('mouseenter', stopAutoSlide);
        carousel.addEventListener('mouseleave', startAutoSlide);
        
        // Handle manual navigation (prev/next buttons)
        const prevBtn = carousel.querySelector('.carousel-control-prev');
        const nextBtn = carousel.querySelector('.carousel-control-next');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                currentSlide = (currentSlide + 1) % totalSlides;
            });
        }
        
        // Handle indicator clicks
        const indicators = carousel.querySelectorAll('.carousel-indicators button');
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', function() {
                currentSlide = index;
            });
        });
    }
});
